import dagre from '@dagrejs/dagre'
import { PostgresTable } from '@gregnr/postgres-meta/base'
import { uniqBy } from 'lodash'
import { Loader } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  Position,
  useReactFlow,
  useStore,
} from 'reactflow'
import { cn } from 'ui'
import { useTablesQuery } from '~/data/tables/tables-query'
import { useDebounce } from '~/lib/hooks'
import SchemaGraphLegend from './legend'
import { TABLE_NODE_ROW_HEIGHT, TABLE_NODE_WIDTH, TableEdge, TableNode } from './table-node'

export default function TablesGraph({ schema }: { schema: string }) {
  const { resolvedTheme } = useTheme()

  const {
    data: tables,
    error,
    isError,
    isLoading,
  } = useTablesQuery({ schemas: [schema], includeColumns: true })

  const isEmpty = tables && tables.length === 0

  const reactFlowInstance = useReactFlow<TableNodeData>()
  const nodeTypes = useMemo(
    () => ({
      table: TableNode,
    }),
    []
  )
  const edgeTypes = useMemo(
    () => ({
      table: TableEdge,
    }),
    []
  )

  const fitView = useCallback(() => {
    reactFlowInstance.fitView({
      padding: 0.4,
      duration: 500,
    })
  }, [reactFlowInstance])

  useEffect(() => {
    if (tables) {
      getGraphDataFromTables(tables).then(({ nodes, edges }) => {
        reactFlowInstance.setNodes(nodes)
        reactFlowInstance.setEdges(edges)

        // it needs to happen during next event tick
        setTimeout(() => fitView(), 100)
      })
    }
  }, [reactFlowInstance, tables, resolvedTheme, fitView])

  return (
    <ReactFlow
      className="bg-neutral-800 rounded-md border-[0.5px] border-neutral-800 overflow-hidden"
      defaultNodes={[]}
      defaultEdges={[]}
      defaultEdgeOptions={{
        type: 'smoothstep',
        deletable: false,
        style: {
          stroke: 'hsl(var(--border-stronger))',
          strokeWidth: 2,
          strokeDasharray: 10,
          strokeDashoffset: -10,
          // Manually create animation so that it doesn't interfere with our custom edge component
          animation: 'dashdraw 0.5s linear infinite',
        },
      }}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.4}
      maxZoom={1}
      proOptions={{ hideAttribution: true }}
    >
      <ResizeHandler onResize={() => fitView()} />
      <Background
        gap={32}
        className={cn(
          'bg-neutral-800 transition-colors',
          isLoading || isError || isEmpty ? 'text-neutral-700' : 'text-neutral-500'
        )}
        variant={BackgroundVariant.Dots}
        size={2}
        color="currentColor"
      />

      <div className="absolute w-full h-full flex justify-center items-center text-center p-4 font-medium">
        {isLoading && (
          <div className="flex gap-4 items-center text-lighter">
            <Loader className="animate-spin" size={28} />
            <p className="text-xl">Loading schema...</p>
          </div>
        )}

        {isError && (
          <div className="flex gap-2 text-lighter">
            <p>Error loading schema from the database:</p>
            <p>{`${error?.message ?? 'Unknown error'}`}</p>
          </div>
        )}

        {isEmpty && <h2 className="text-4xl text-lighter font-light">Ask AI to create a table</h2>}
      </div>

      <Controls showZoom={false} showInteractive={false} position="top-right" />
      <SchemaGraphLegend />
    </ReactFlow>
  )
}

type TableNodeData = {
  name: string
  isForeign: boolean
  columns: {
    id: string
    isPrimary: boolean
    isNullable: boolean
    isUnique: boolean
    isUpdateable: boolean
    isIdentity: boolean
    name: string
    format: string
  }[]
}

async function getGraphDataFromTables(tables: PostgresTable[]): Promise<{
  nodes: Node<TableNodeData>[]
  edges: Edge[]
}> {
  if (!tables.length) {
    return { nodes: [], edges: [] }
  }

  const nodes = tables.map((table) => {
    const columns = (table.columns || [])
      .sort((a, b) => a.ordinal_position - b.ordinal_position)
      .map((column) => {
        return {
          id: column.id,
          isPrimary: table.primary_keys.some((pk) => pk.name === column.name),
          name: column.name,
          format: column.format,
          isNullable: column.is_nullable,
          isUnique: column.is_unique,
          isUpdateable: column.is_updatable,
          isIdentity: column.is_identity,
        }
      })

    return {
      id: `${table.id}`,
      type: 'table',
      data: {
        name: table.name,
        isForeign: false,
        columns,
      },
      position: { x: 0, y: 0 },
    }
  })

  const edges: Edge[] = []
  const currentSchema = tables[0].schema
  const uniqueRelationships = uniqBy(
    tables.flatMap((t) => t.relationships),
    'id'
  )

  for (const rel of uniqueRelationships) {
    // TODO: Support [external->this] relationship?
    if (rel.source_schema !== currentSchema) {
      continue
    }

    // Create additional [this->foreign] node that we can point to on the graph.
    if (rel.target_table_schema !== currentSchema) {
      nodes.push({
        id: rel.constraint_name,
        type: 'table',
        data: {
          name: `${rel.target_table_schema}.${rel.target_table_name}.${rel.target_column_name}`,
          isForeign: true,
          columns: [],
        },
        position: { x: 0, y: 0 },
      })

      const [source, sourceHandle] = findTablesHandleIds(
        tables,
        rel.source_table_name,
        rel.source_column_name
      )

      if (source) {
        edges.push({
          id: String(rel.id),
          type: 'table',
          source,
          sourceHandle,
          target: rel.constraint_name,
          targetHandle: rel.constraint_name,
        })
      }

      continue
    }

    const [source, sourceHandle] = findTablesHandleIds(
      tables,
      rel.source_table_name,
      rel.source_column_name
    )
    const [target, targetHandle] = findTablesHandleIds(
      tables,
      rel.target_table_name,
      rel.target_column_name
    )

    // We do not support [external->this] flow currently.
    if (source && target) {
      edges.push({
        id: String(rel.id),
        type: 'table',
        source,
        sourceHandle,
        target,
        targetHandle,
      })
    }
  }

  return layoutElements(nodes, edges)
}

function findTablesHandleIds(
  tables: PostgresTable[],
  table_name: string,
  column_name: string
): [string?, string?] {
  for (const table of tables) {
    if (table_name !== table.name) continue

    for (const column of table.columns || []) {
      if (column_name !== column.name) continue

      return [String(table.id), column.id]
    }
  }

  return []
}

/**
 * Positions nodes relative to each other on the graph using `dagre`.
 */
const layoutElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: 'LR',
    align: 'UR',
    nodesep: 50,
    ranksep: 50,
  })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: TABLE_NODE_WIDTH / 2,
      height: (TABLE_NODE_ROW_HEIGHT / 2) * (node.data.columns.length + 1), // columns + header
    })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = Position.Left
    node.sourcePosition = Position.Right
    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWithPosition.width / 2,
      y: nodeWithPosition.y - nodeWithPosition.height / 2,
    }

    return node
  })

  return { nodes, edges }
}

/**
 * Hook to detect React Flow container resizes.
 * Calls `fn` when `width` or `height` changes.
 *
 * Debounces at 200ms by default.
 */
function useOnResize(fn: () => void, debounce = 200) {
  const reactFlowInstance = useReactFlow()

  const width = useStore(({ width }) => width)
  const height = useStore(({ height }) => height)

  const debouncedWidth = useDebounce(width, debounce)
  const debouncedHeight = useDebounce(height, debounce)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fn, [reactFlowInstance, debouncedWidth, debouncedHeight])
}

type ResizeHandlerProps = {
  onResize: () => void
  debounce?: number
}

/**
 * Component to detect React Flow container resizes.
 * Calls `onResize` when `width` or `height` changes.
 *
 * Debounces at 200ms by default.
 *
 * It's better to use this child component instead of the
 * `useOnResize` hook directly in order to prevent a large
 * amount of re-renders on the main component.
 */
function ResizeHandler({ onResize, debounce = 200 }: ResizeHandlerProps) {
  useOnResize(onResize, debounce)

  return null
}
