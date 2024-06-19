import { PopoverClose } from '@radix-ui/react-popover'
import { Button } from '@ui/components/shadcn/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/shadcn/ui/popover'
import { useChat } from 'ai/react'
import { AnimatePresence, m } from 'framer-motion'
import {
  CircleSlash,
  DiamondIcon,
  Fingerprint,
  Hash,
  Key,
  Network,
  Pencil,
  Table2,
} from 'lucide-react'
import { useState } from 'react'
import {
  EdgeProps,
  Handle,
  NodeProps,
  Position,
  getSmoothStepPath,
  useOnViewportChange,
  useUpdateNodeInternals,
} from 'reactflow'
import { cn } from 'ui'

// ReactFlow is scaling everything by the factor of 2
export const TABLE_NODE_WIDTH = 640
export const TABLE_NODE_ROW_HEIGHT = 80

export type TableNodeData = {
  name: string
  isForeign: boolean
  columns: {
    id: string
    isPrimary: boolean
    isNullable: boolean
    isUnique: boolean
    isIdentity: boolean
    name: string
    format: string
  }[]
}

const inOutTop = {
  hidden: {
    opacity: 0,
    y: -40,
  },
  show: {
    opacity: 1,
    y: 0,
  },
}

// Important styles is a nasty hack to use Handles (required for edges calculations), but do not show them in the UI.
// ref: https://github.com/wbkd/react-flow/discussions/2698
const hiddenNodeConnector = '!h-px !w-px !min-w-0 !min-h-0 !cursor-grab !border-0 !opacity-0'

const itemHeight = 'h-[44px]'

/**
 * Custom node to display database tables.
 */
export const TableNode = ({
  id,
  data,
  targetPosition,
  sourcePosition,
}: NodeProps<TableNodeData>) => {
  const updateNodeInternals = useUpdateNodeInternals()
  const [showHandles, setShowHandles] = useState(false)

  if (data.isForeign) {
    return (
      <header className="text-[1.1rem] px-4 py-2 border-[1px] rounded-[8px] bg-alternative text-default flex gap-2 items-center">
        {data.name}
        {targetPosition && (
          <Handle
            type="target"
            id={data.name}
            position={targetPosition}
            className={cn(hiddenNodeConnector)}
          />
        )}
      </header>
    )
  }

  return (
    <m.div
      className="overflow-hidden rounded-[8px] bg-scale-400"
      style={{ width: TABLE_NODE_WIDTH / 2 }}
      variants={{
        hidden: {
          scale: 0,
        },
        show: {
          scale: 1,
        },
      }}
      initial="hidden"
      animate="show"
      onAnimationComplete={() => {
        setShowHandles(true)
        updateNodeInternals(id)
      }}
    >
      <header
        className={cn(
          'text-[1.1rem] px-4 bg-brand-600 text-white flex gap-2 items-center',
          itemHeight
        )}
      >
        <Table2 strokeWidth={2} size={24} className="" />

        {/* Animate the old title out and new title in */}
        <AnimatePresence mode="popLayout">
          <m.span
            key={data.name}
            className="font-medium"
            variants={inOutTop}
            initial="hidden"
            animate="show"
            exit="hidden"
          >
            {data.name}
          </m.span>
        </AnimatePresence>
      </header>

      {data.columns.map((column) => (
        <TableColumn
          key={column.id}
          column={column}
          data={data}
          showHandles={showHandles}
          sourcePosition={sourcePosition}
          targetPosition={targetPosition}
        />
      ))}
    </m.div>
  )
}

type TableColumnProps = {
  column: TableNodeData['columns'][number]
  data: TableNodeData
  showHandles: boolean
  sourcePosition?: Position
  targetPosition?: Position
}

function TableColumn({
  column,
  data,
  showHandles,
  sourcePosition,
  targetPosition,
}: TableColumnProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)

  useOnViewportChange({
    onChange() {
      setIsPopoverOpen(false)
    },
  })

  const { append } = useChat({
    id: 'main',
    api: 'api/chat',
  })

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={(open) => {
        setIsPopoverOpen(open)
        if (!open) {
          setIsRenaming(false)
        }
      }}
    >
      <PopoverTrigger asChild className="cursor-pointer">
        <m.div
          className={cn(
            'text-[16px] leading-10 relative flex flex-row justify-items-start',
            'bg-neutral-300',
            'border-t border-neutral-200',
            'border-t-[1px]',
            'overflow-hidden',
            itemHeight
          )}
          variants={{
            hidden: {
              opacity: 0,
            },
            show: {
              opacity: 1,
            },
          }}
          initial="hidden"
          animate="show"
          exit="hidden"
          transition={{ staggerChildren: 0.05 }}
        >
          <div
            className={cn(
              'gap-[0.48rem] flex mx-4 align-middle items-center justify-start',
              column.isPrimary && 'basis-1/5'
            )}
          >
            {/* Animate the icon in and out */}
            <AnimatePresence mode="popLayout">
              {column.isPrimary && (
                <m.div
                  key={String(column.isPrimary)}
                  variants={inOutTop}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                >
                  <Key size={16} strokeWidth={2} className={cn('flex-shrink-0', 'text-light')} />
                </m.div>
              )}
            </AnimatePresence>

            {/* Animate the old icon out and new icon in */}
            <AnimatePresence mode="popLayout">
              {column.isNullable ? (
                <m.div
                  key={String(column.isNullable)}
                  variants={inOutTop}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                >
                  <DiamondIcon size={16} strokeWidth={2} className="flex-shrink-0 text-light" />
                </m.div>
              ) : (
                <m.div
                  key={String(column.isNullable)}
                  variants={inOutTop}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                >
                  <DiamondIcon
                    size={16}
                    strokeWidth={2}
                    fill="currentColor"
                    className="flex-shrink-0 text-light"
                  />
                </m.div>
              )}
            </AnimatePresence>

            {/* Animate the icon in and out */}
            <AnimatePresence mode="popLayout">
              {column.isUnique && (
                <m.div
                  key={String(column.isUnique)}
                  variants={inOutTop}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                >
                  <Fingerprint size={16} strokeWidth={2} className="flex-shrink-0 text-light" />
                </m.div>
              )}
            </AnimatePresence>

            {/* Animate the icon in and out */}
            <AnimatePresence mode="popLayout">
              {column.isIdentity && (
                <m.div
                  key={String(column.isIdentity)}
                  variants={inOutTop}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                >
                  <Hash size={16} strokeWidth={2} className="flex-shrink-0 text-light" />
                </m.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex w-full justify-between">
            {/* Animate the old name out and new name in */}
            <AnimatePresence mode="popLayout">
              <m.span
                key={column.name}
                className="text-ellipsis overflow-hidden whitespace-nowrap max-w-[170px]"
                variants={inOutTop}
                initial="hidden"
                animate="show"
                exit="hidden"
              >
                {column.name}
              </m.span>
            </AnimatePresence>

            {/* Animate the old type out and new type in */}
            <AnimatePresence mode="popLayout">
              <m.span
                key={column.format}
                className="px-4 inline-flex justify-end font-mono text-lighter text-[0.8rem]"
                variants={inOutTop}
                initial="hidden"
                animate="show"
                exit="hidden"
              >
                {column.format}
              </m.span>
            </AnimatePresence>
          </div>

          {showHandles && targetPosition && (
            <Handle
              type="target"
              id={column.id}
              position={targetPosition}
              className={cn(hiddenNodeConnector, '!left-0')}
            />
          )}

          {showHandles && sourcePosition && (
            <Handle
              type="source"
              id={column.id}
              position={sourcePosition}
              className={cn(hiddenNodeConnector, '!right-0')}
            />
          )}
        </m.div>
      </PopoverTrigger>
      <PopoverContent className="p-2 flex flex-col" portal>
        {isRenaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()

              if (e.target instanceof HTMLFormElement) {
                const formData = new FormData(e.target)
                const newName = formData.get('name')

                append({
                  role: 'user',
                  content: `Rename the "${column.name}" column in the ${data.name} table to "${newName}"`,
                })
              }

              setIsPopoverOpen(false)
              setIsRenaming(false)
            }}
          >
            <input
              name="name"
              className="flex-grow border-none focus-visible:ring-0 text-base bg-inherit placeholder:text-neutral-400"
              placeholder={`Rename ${column.name}`}
              autoComplete="off"
              autoFocus
            />
          </form>
        ) : (
          <>
            <Button
              className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
              onClick={() => setIsRenaming(true)}
            >
              <Pencil size={16} strokeWidth={2} className="flex-shrink-0 text-light" />
              <span>Rename column</span>
            </Button>
            <PopoverClose asChild>
              <Button
                className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
                onClick={() =>
                  append({
                    role: 'user',
                    content: `Make the "${column.name}" column in the ${data.name} table ${column.isNullable ? 'not nullable' : 'nullable'}`,
                  })
                }
              >
                <DiamondIcon
                  size={16}
                  strokeWidth={2}
                  fill={column.isNullable ? 'currentColor' : 'none'}
                  className="flex-shrink-0 text-light"
                />
                <span>Make {column.isNullable ? 'not nullable' : 'nullable'}</span>
              </Button>
            </PopoverClose>
            <PopoverClose asChild>
              <Button
                className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
                onClick={() =>
                  append({
                    role: 'user',
                    content: `Make the "${column.name}" column in the ${data.name} table ${column.isUnique ? 'not unique' : 'unique'}`,
                  })
                }
              >
                {column.isUnique ? (
                  <CircleSlash size={16} strokeWidth={2} className="flex-shrink-0 text-light" />
                ) : (
                  <Fingerprint size={16} strokeWidth={2} className="flex-shrink-0 text-light" />
                )}

                <span>Make {column.isUnique ? 'not unique' : 'unique'}</span>
              </Button>
            </PopoverClose>
            <PopoverClose asChild>
              <Button
                className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
                onClick={() =>
                  append({
                    role: 'user',
                    content: `Help me choose the best index for the "${column.name}" column in the ${data.name} table`,
                  })
                }
              >
                <Network size={16} strokeWidth={2} className="flex-shrink-0 text-light" />

                <span>Create index</span>
              </Button>
            </PopoverClose>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Custom edge that animates its path length.
 */
export function TableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  markerEnd,
  markerStart,
  pathOptions,
}: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: pathOptions?.borderRadius,
    offset: pathOptions?.offset,
  })

  return (
    <>
      <defs>
        {/* Create a mask with the same shape that animates its path length */}
        <mask id={`mask-${id}`}>
          <m.path
            d={path}
            fill="none"
            stroke="white"
            strokeWidth={10}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25 }}
          />
        </mask>
      </defs>
      <path
        id={id}
        d={path}
        style={style}
        className={cn(['react-flow__edge-path'])}
        fill="none"
        mask={`url(#mask-${id})`}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
    </>
  )
}
