import { openai } from '@ai-sdk/openai'
import { ToolInvocation, convertToCoreMessages, streamText } from 'ai'
import { codeBlock } from 'common-tags'
import { z } from 'zod'
import { reportSchema, tabsSchema } from '~/lib/schema'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

type FileData = {
  type: 'file'
  file: {
    id: string
    type: string
    name: string
    size: number
    lastModified: number
    text: string
  }
}

type Data = FileData

type Message = {
  role: 'user' | 'assistant'
  content: string
  data?: Data
  toolInvocations?: (ToolInvocation & { result: any })[]
}

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json()

  const result = await streamText({
    system: codeBlock`
      You are a helpful database assistant. Under the hood you have access to a Postgres database.

      When generating tables, do the following:
      - For primary keys, always use "id bigint primary key generated always as identity" (not serial)
      - Prefer 'text' over 'varchar'
      - Keep explanations brief but helpful

      When creating sample data:
      - Make the data realistic, including joined data
      - Check for existing records/conflicts in the table

      When querying data, limit to 5 by default.
      
      You also know math. All math equations and expressions must be written in KaTex and must be wrapped in double dollar \`$$\`:
        - Inline: $$\\sqrt{26}$$
        - Multiline:
            $$
            \\sqrt{26}
            $$

      No images are allowed. Do not try to generate or link images.

      Err on the side of caution. Ask the user to confirm before any mutating operations.
      
      If you're just querying schema, data, or showing charts, go ahead and do it without asking.

      Feel free to suggest corrections for suspected typos.
    `,
    model: openai('gpt-4o-2024-05-13'),
    messages: convertToCoreMessages(messages),
    tools: {
      getDatabaseSchema: {
        description:
          'Gets all table and column data within the public schema in the Postgres database.',
        parameters: z.object({}),
      },
      executeSql: {
        description:
          "Executes Postgres SQL against the user's database. Perform joins automatically. Always add limits for safety.",
        parameters: z.object({ sql: z.string() }),
      },
      brainstormReports: {
        description: 'Brainstorms some interesting reports to show to the user.',
        parameters: z.object({
          reports: z.array(reportSchema),
        }),
      },
      generateChart: {
        description: codeBlock`
          Generates a chart using Chart.js for a given SQL query.
          - Label both axises
          - Plugins are not available
          
          Call \`executeSql\` first.
        `,
        parameters: z.object({
          config: z
            .any()
            .describe(
              'The `config` passed to `new Chart(ctx, config). Includes `type`, `data`, `options`, etc.'
            ),
        }),
      },
      switchTab: {
        description: codeBlock`
          Switches to a different tab.
        `,
        parameters: z.object({
          tab: tabsSchema,
        }),
      },
      requestCsv: {
        description: codeBlock`
          Requests a CSV upload from the user.
        `,
        parameters: z.object({}),
      },
      importCsv: {
        description: codeBlock`
          Imports a CSV file with the specified ID into a table. Call \`requestCsv\` first.
          
          Check if any existing tables can import this or
          otherwise create new table using \`executeSql\` first.
        `,
        parameters: z.object({
          fileId: z.string().describe('The ID of the CSV file to import'),
          sql: z.string().describe(codeBlock`
            The Postgres COPY command to import the CSV into the table.

            The file will be temporarily available on the server at '/tmp/{id}.csv'.
          `),
        }),
      },
    },
  })

  return result.toAIStreamResponse()
}
