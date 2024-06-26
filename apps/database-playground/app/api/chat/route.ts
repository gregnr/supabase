import { openai } from '@ai-sdk/openai'
import { ToolInvocation, convertToCoreMessages, streamText } from 'ai'
import { codeBlock } from 'common-tags'
import { convertToCoreTools, tools } from '~/lib/tools'

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
    tools: convertToCoreTools(tools),
  })

  return result.toAIStreamResponse()
}
