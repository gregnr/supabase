import { Editor } from '@monaco-editor/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/shadcn/ui/tabs'
import { useBreakpoint } from 'common'
import { assertDefined } from 'common/sql-util'
import { deparse, parseQuery, ParseResult } from 'libpg-query/wasm'
import { FileCode, MessageSquareMore, Sprout, Workflow } from 'lucide-react'
import { PropsWithChildren, useEffect, useState } from 'react'
import { format } from 'sql-formatter'
import { useMessagesQuery } from '~/data/messages/messages-query'
import { useAsyncMemo } from '~/lib/hooks'
import { tabsSchema, TabValue } from '~/lib/schema'
import { isMigrationStatement } from '~/lib/sql-util'
import { ToolInvocation } from '~/lib/tools'
import SchemaGraph from './schema/graph'

const initialMigrationSql = '-- Migrations will appear here as you chat with Supabase AI\n'
const initialSeedSql = '-- Seeds will appear here as you chat with Supabase AI\n'

export type IDEProps = PropsWithChildren<{
  databaseId: string
}>

export default function IDE({ children, databaseId }: IDEProps) {
  const [tab, setTab] = useState<TabValue>('diagram')

  const isSmallBreakpoint = useBreakpoint('lg')
  const { data: messages, refetch: refetchMessages } = useMessagesQuery(databaseId)

  useEffect(() => {
    if (isSmallBreakpoint) {
      setTab('chat')
    } else {
      setTab('diagram')
    }
  }, [isSmallBreakpoint])

  const { value: migrationStatements } = useAsyncMemo(async () => {
    const sqlExecutions =
      messages
        ?.flatMap((message) => {
          if (!message.toolInvocations) {
            return
          }

          const toolInvocations = message.toolInvocations as ToolInvocation[]

          return toolInvocations
            .map((tool) =>
              // Only include SQL that successfully executed against the DB
              tool.toolName === 'executeSql' && 'result' in tool && tool.result.success === true
                ? tool.args.sql
                : undefined
            )
            .filter((sql) => sql !== undefined)
        })
        .filter((sql) => sql !== undefined) ?? []

    const migrations: string[] = []

    for (const sql of sqlExecutions) {
      const parseResult = await parseQuery(sql)
      assertDefined(parseResult.stmts, 'Expected stmts to exist in parse result')

      const migrationStmts = parseResult.stmts.filter(isMigrationStatement)

      if (migrationStmts.length > 0) {
        const filteredAst: ParseResult = {
          version: parseResult.version,
          stmts: migrationStmts,
        }

        const migrationSql = await deparse(filteredAst)

        const formattedSql = format(migrationSql, {
          language: 'postgresql',
          keywordCase: 'lower',
          identifierCase: 'lower',
          dataTypeCase: 'lower',
          functionCase: 'lower',
        })

        const withSemicolon = formattedSql.endsWith(';') ? formattedSql : `${formattedSql};`

        migrations.push(withSemicolon)
      }
    }

    return migrations
  }, [messages])

  const migrationsSql = (initialMigrationSql + '\n' + migrationStatements?.join('\n\n')).trim()

  return (
    <Tabs
      className="flex-1 h-full flex flex-col items-stretch"
      value={tab}
      onValueChange={(tab) => setTab(tabsSchema.parse(tab))}
    >
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-2">
        {isSmallBreakpoint && (
          <TabsTrigger value="chat" className="flex items-center gap-1">
            <MessageSquareMore size={14} />
            <span className="hidden xs:inline">Chat</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="diagram" className="flex items-center gap-1">
          <Workflow size={14} />
          <span className="hidden xs:inline">Diagram</span>
        </TabsTrigger>
        <TabsTrigger value="migrations" className="flex items-center gap-1">
          <FileCode size={14} />
          <span className="hidden xs:inline">Migrations</span>
        </TabsTrigger>
        {/* Temporarily hide seeds until we get pg_dump working */}
        {false && (
          <TabsTrigger value="seeds" className="flex items-center gap-1">
            <Sprout size={14} />
            <span className="hidden xs:inline">Seeds</span>
          </TabsTrigger>
        )}
      </TabsList>

      {isSmallBreakpoint && (
        <TabsContent value="chat" className="flex-1 h-full min-h-0">
          {children}
        </TabsContent>
      )}
      <TabsContent value="diagram" className="h-full">
        <SchemaGraph databaseId={databaseId} schema="public" />
      </TabsContent>
      <TabsContent value="migrations" className="h-full py-4 rounded-md bg-[#1e1e1e]">
        <Editor
          language="pgsql"
          value={migrationsSql}
          theme="vs-dark"
          options={{
            tabSize: 2,
            minimap: {
              enabled: false,
            },
            fontSize: 13,
            readOnly: true,
          }}
          onMount={async (editor, monaco) => {
            // Register pgsql formatter
            monaco.languages.registerDocumentFormattingEditProvider('pgsql', {
              async provideDocumentFormattingEdits(model) {
                const currentCode = editor.getValue()
                const formattedCode = format(currentCode, {
                  language: 'postgresql',
                  keywordCase: 'lower',
                })
                return [
                  {
                    range: model.getFullModelRange(),
                    text: formattedCode,
                  },
                ]
              },
            })

            // Format on cmd+s
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
              await editor.getAction('editor.action.formatDocument').run()
            })

            // Run format on the initial value
            await editor.getAction('editor.action.formatDocument').run()
          }}
        />
      </TabsContent>
      {/* Temporarily hide seeds until we get pg_dump working */}
      {false && (
        <TabsContent value="seeds" className="h-full py-4 rounded-md bg-[#1e1e1e]">
          <Editor
            language="pgsql"
            theme="vs-dark"
            options={{
              tabSize: 2,
              minimap: {
                enabled: false,
              },
              fontSize: 13,
              readOnly: true,
            }}
            onMount={async (editor, monaco) => {
              // Register pgsql formatter
              monaco.languages.registerDocumentFormattingEditProvider('pgsql', {
                async provideDocumentFormattingEdits(model) {
                  const currentCode = editor.getValue()
                  const formattedCode = format(currentCode, {
                    language: 'postgresql',
                    keywordCase: 'lower',
                  })
                  return [
                    {
                      range: model.getFullModelRange(),
                      text: formattedCode,
                    },
                  ]
                },
              })

              // Format on cmd+s
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
                await editor.getAction('editor.action.formatDocument').run()
              })

              // Run format on the initial value
              await editor.getAction('editor.action.formatDocument').run()
            }}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}
