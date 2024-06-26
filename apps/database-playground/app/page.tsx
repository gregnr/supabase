'use client'

import 'chartjs-adapter-date-fns'

import { Editor } from '@monaco-editor/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/shadcn/ui/tabs'
import { generateId } from 'ai'
import { useChat } from 'ai/react'
import { Chart } from 'chart.js'
import { useBreakpoint } from 'common'
import { assertDefined } from 'common/sql-util'
import { LazyMotion } from 'framer-motion'
import { parseQuery } from 'libpg-query/wasm'
import { FileCode, MessageSquareMore, Settings, Sprout, Workflow } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { format } from 'sql-formatter'
import { Button } from 'ui/src/components/shadcn/ui/button'
import Chat, { getInitialMessages } from '~/components/chat'
import SchemaGraph from '~/components/schema/graph'
import { useTablesQuery } from '~/data/tables/tables-query'
import { db, resetDb } from '~/lib/db'
import { loadFile, saveFile } from '~/lib/files'
import { useLocalStorage } from '~/lib/hooks'
import { TabValue, tabsSchema } from '~/lib/schema'
import { groupStatements } from '~/lib/sql-util'
import { OnToolCall } from '~/lib/tools'

const loadFramerFeatures = () => import('./framer-features').then((res) => res.default)

const initialMigrationSql = '-- Migrations will appear here as you chat with Supabase AI\n'
const initialSeedSql = '-- Seeds will appear here as you chat with Supabase AI\n'

export default function Page() {
  const [tab, setTab] = useState<TabValue>('diagram')

  const [migrationSql, setMigrationSql] = useLocalStorage('migrations', initialMigrationSql)
  const [seedSql, setSeedSql] = useLocalStorage('seeds', initialSeedSql)

  const { refetch } = useTablesQuery({ schemas: ['public'], includeColumns: true })

  const isSmallBreakpoint = useBreakpoint('lg')

  useEffect(() => {
    if (isSmallBreakpoint) {
      setTab('chat')
    } else {
      setTab('diagram')
    }
  }, [isSmallBreakpoint])

  const { setMessages } = useChat({
    id: 'main',
    api: 'api/chat',
  })

  const onToolCall = useCallback<OnToolCall>(
    async ({ toolCall }) => {
      switch (toolCall.toolName) {
        case 'getDatabaseSchema': {
          const { data: tables, error } = await refetch()

          // TODO: handle this error in the UI
          if (error) {
            throw error
          }

          return {
            success: true,
            tables,
          }
        }
        case 'brainstormReports': {
          return {
            success: true,
            message: 'Reports have been brainstormed. Relay this info to the user.',
          }
        }
        case 'executeSql': {
          try {
            const { sql } = toolCall.args

            const parseResult = await parseQuery(sql)

            assertDefined(parseResult.stmts, 'Expected parse result to contain statements')

            const { seeds, migrations } = groupStatements(parseResult.stmts)

            const results = await db.exec(sql)

            // TODO: use libpg-query de-parser once released
            // This assumes every statement is a seed or migration,
            // which might not be true
            if (seeds.length > 0) {
              setSeedSql((s) => {
                const newSql = (s + '\n' + sql).trim()
                return format(newSql, {
                  language: 'postgresql',
                  keywordCase: 'lower',
                  identifierCase: 'lower',
                  dataTypeCase: 'lower',
                  functionCase: 'lower',
                })
              })
            } else if (migrations.length > 0) {
              setMigrationSql((s) => {
                const newSql = (s + '\n' + sql).trim()
                return format(newSql, {
                  language: 'postgresql',
                  keywordCase: 'lower',
                  identifierCase: 'lower',
                  dataTypeCase: 'lower',
                  functionCase: 'lower',
                })
              })
            }

            const { data: tables, error } = await refetch()

            // TODO: handle this error in the UI
            if (error) {
              throw error
            }

            return {
              success: true,
              queryResults: results,
              updatedSchema: tables,
            }
          } catch (err) {
            if (err instanceof Error) {
              console.log(err.message)
              return { success: false, error: err.message }
            }
            throw err
          }
        }
        case 'generateChart': {
          // TODO: correct zod schema for Chart.js `config`
          const { config } = toolCall.args as any

          // Validate that the chart can be rendered without error
          const canvas = document.createElement('canvas', {})
          canvas.className = 'invisible'
          document.body.appendChild(canvas)

          try {
            const chart = new Chart(canvas, config)
            chart.destroy()
            return {
              success: true,
              message:
                "The chart has been generated and displayed to the user above. Acknowledge the user's request.",
            }
          } catch (err) {
            if (err instanceof Error) {
              return { success: false, error: err.message }
            }
            throw err
          } finally {
            canvas.remove()
          }
        }
        case 'switchTab': {
          const { tab } = toolCall.args

          setTab(tab)

          return {
            success: true,
            message: `The UI successfully switch to the '${tab}' tab. Acknowledge the user's request.`,
          }
        }
        case 'importCsv': {
          const { fileId, sql } = toolCall.args

          // Temporary file in the DB's virtual FS
          const tempFile = `/tmp/${fileId}.csv`

          try {
            const file = await loadFile(fileId)
            const csv = await file.text()

            await db.writeFile(tempFile, csv.trim())
            await db.exec(sql)
            await db.removeFile(tempFile)
            await refetch()

            return {
              success: true,
              message: 'The CSV has been imported successfully.',
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'An unknown error has occurred',
            }
          }
        }
        case 'exportCsv': {
          const { fileName, sql } = toolCall.args

          // Temporary file in the DB's virtual FS
          const tempFile = `/tmp/${fileName}`
          const fileId = generateId()

          try {
            await db.exec(sql)
            const data = await db.readFile(tempFile)
            await db.removeFile(tempFile)
            const file = new File([data], fileName, { type: 'text/csv' })
            await saveFile(fileId, file)

            return {
              success: true,
              message: 'The query as been successfully exported as a CSV. Do not link to it.',
              fileId,
              file: {
                name: file.name,
                size: file.size,
                type: file.type,
              },
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'An unknown error has occurred',
            }
          }
        }
      }
    },
    [refetch]
  )

  return (
    <LazyMotion features={loadFramerFeatures}>
      <div className="w-full h-full flex flex-col lg:flex-row p-6 gap-8">
        <Tabs
          className="flex-1 h-full flex flex-col items-stretch"
          value={tab}
          onValueChange={(tab) => setTab(tabsSchema.parse(tab))}
        >
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-4">
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
            <TabsTrigger value="seeds" className="flex items-center gap-1">
              <Sprout size={14} />
              <span className="hidden xs:inline">Seeds</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings size={14} />
              <span className="hidden xs:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {isSmallBreakpoint && (
            <TabsContent value="chat" className="flex-1 h-full min-h-0">
              <Chat onToolCall={onToolCall} />
            </TabsContent>
          )}
          <TabsContent value="diagram" className="h-full">
            <SchemaGraph schema="public" />
          </TabsContent>
          <TabsContent value="migrations" className="h-full py-4 rounded-md bg-[#1e1e1e]">
            <Editor
              language="pgsql"
              value={migrationSql}
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
          <TabsContent value="seeds" className="h-full py-4 rounded-md bg-[#1e1e1e]">
            <Editor
              language="pgsql"
              value={seedSql}
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
          <TabsContent value="settings" className="h-full">
            <Button
              onClick={async () => {
                await resetDb()
                const { data: tables } = await refetch()
                setSeedSql(initialSeedSql)
                setMigrationSql(initialMigrationSql)
                setTab('diagram')
                setMessages(getInitialMessages(tables))
              }}
            >
              Reset database
            </Button>
          </TabsContent>
        </Tabs>

        {!isSmallBreakpoint && (
          <div className="flex-1 h-full">
            <Chat onToolCall={onToolCall} />
          </div>
        )}
      </div>
    </LazyMotion>
  )
}
