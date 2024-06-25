'use client'

import 'chart.js/auto'

import { Results as QueryResults } from '@gregnr/pglite'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/components/shadcn/ui/accordion'
import { Message, ToolInvocation, generateId } from 'ai'
import { useChat } from 'ai/react'
import { m } from 'framer-motion'
import { DatabaseZap, Paperclip } from 'lucide-react'
import { memo } from 'react'
import { Chart } from 'react-chartjs-2'
import { ErrorBoundary } from 'react-error-boundary'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { CodeBlock, markdownComponents } from 'ui'
import { loadFile, saveFile } from '~/lib/files'
import { downloadFile } from '~/lib/util'

export type ChatMessageProps = {
  message: Message
  isLast: boolean
}

function ChatMessage({ message }: ChatMessageProps) {
  switch (message.role) {
    case 'user':
      return (
        <m.div
          layoutId={message.id}
          variants={{
            hidden: {
              opacity: 0,
              y: 10,
            },
            show: {
              opacity: 1,
              y: 0,
            },
          }}
          initial="hidden"
          animate="show"
          className="self-end px-5 py-2.5 text-base rounded-full bg-neutral-100"
        >
          {message.content}
        </m.div>
      )
    case 'assistant':
      const markdown = message.content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
          rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
          components={{ ...markdownComponents, img: () => null }}
          className="prose [&_.katex-display>.katex]:text-left"
        >
          {message.content}
        </ReactMarkdown>
      ) : null

      const toolElements =
        message.toolInvocations
          ?.map((toolInvocation) => (
            <ToolUi key={toolInvocation.toolCallId} toolInvocation={toolInvocation} />
          ))
          .filter(Boolean) ?? []

      if (!markdown && toolElements.length === 0) {
        return null
      }

      return (
        <div className="ml-4 self-stretch flex flex-col items-stretch gap-6">
          {markdown}
          {toolElements}
        </div>
      )
  }
}

type ToolUiProps = {
  toolInvocation: ToolInvocation
}

function ToolUi({ toolInvocation }: ToolUiProps) {
  const { addToolResult } = useChat({
    id: 'main',
    api: 'api/chat',
  })

  switch (toolInvocation.toolName) {
    case 'executeSql': {
      if (!('result' in toolInvocation)) {
        return null
      }

      if ('error' in toolInvocation.result) {
        return <div className="bg-destructive-300 px-6 py-4 rounded-md">Error executing SQL</div>
      }

      const { sql } = toolInvocation.args
      const queryResults: QueryResults = toolInvocation.result.queryResults.at(-1)

      return (
        <Accordion type="single" collapsible>
          <AccordionItem
            value="item-1"
            className="border-2 border-neutral-100 bg-neutral-50 px-3 py-2 rounded-md"
          >
            <AccordionTrigger className="p-0 gap-2">
              <div className="flex gap-2 items-center font-normal text-lighter text-sm">
                <DatabaseZap size={14} />
                Executed SQL
              </div>
            </AccordionTrigger>
            <AccordionContent className="py-2 [&_>div]:pb-0">
              <CodeBlock
                className="language-sql border-none px-0 pb-4 !bg-inherit"
                hideLineNumbers
                hideCopy
              >
                {sql}
              </CodeBlock>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )
    }
    case 'generateChart': {
      if (!('result' in toolInvocation)) {
        return null
      }

      if ('error' in toolInvocation.result) {
        return <div className="bg-destructive-300 px-6 py-4 rounded-md">Error loading chart</div>
      }

      const { type, data, options } = toolInvocation.args.config
      return (
        <ErrorBoundary
          fallbackRender={() => (
            <div className="bg-destructive-300 px-6 py-4 rounded-md">Error loading chart</div>
          )}
        >
          <m.div
            className="relative w-full max-w-2xl h-[50vw] max-h-96 my-8"
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
          >
            <Chart
              className="max-w-full max-h-full"
              type={type}
              data={data}
              options={{
                ...options,
                maintainAspectRatio: false,
              }}
            />
          </m.div>
        </ErrorBoundary>
      )
    }
    case 'requestCsv': {
      if ('result' in toolInvocation) {
        return (
          <m.div
            layoutId={toolInvocation.toolCallId}
            className="self-end px-5 py-2.5 text-base rounded-full bg-blue-300 flex gap-2 items-center text-lighter italic"
            style={{
              // same value as tailwind, used to keep constant radius during framer animation
              // see: https://www.framer.com/motion/layout-animations/##scale-correction
              borderRadius: 9999,
            }}
          >
            <Paperclip size={14} />
            <m.span
              className="cursor-pointer hover:underline"
              layout
              onClick={async () => {
                const file = await loadFile(toolInvocation.result.fileId)
                downloadFile(file)
              }}
            >
              {toolInvocation.result.file.name}
            </m.span>
          </m.div>
        )
      }

      return (
        <m.div layoutId={toolInvocation.toolCallId}>
          <input
            type="file"
            onChange={async (e) => {
              if (e.target.files) {
                try {
                  const [file] = Array.from(e.target.files)

                  if (!file) {
                    throw new Error('No file found')
                  }

                  if (file.type !== 'text/csv') {
                    throw new Error('File is not a CSV')
                  }

                  const fileId = generateId()

                  await saveFile(fileId, file)

                  const text = await file.text()

                  addToolResult({
                    toolCallId: toolInvocation.toolCallId,
                    result: {
                      success: true,
                      fileId: fileId,
                      file: {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                      },
                      preview: text.split('\n').slice(0, 4).join('\n').trim(),
                    },
                  })
                } catch (error) {
                  addToolResult({
                    toolCallId: toolInvocation.toolCallId,
                    result: {
                      success: false,
                      error: error instanceof Error ? error.message : 'An unknown error occurred',
                    },
                  })
                }
              }
            }}
          />
        </m.div>
      )
    }
  }
  return null
}

// Memoizing is important here - otherwise React continually
// re-renders previous messages unnecessarily (big performance hit)
export default memo(ChatMessage, (prevProps, nextProps) => {
  // Always re-render the last message to fix a bug where `useChat()`
  // doesn't trigger a re-render when multiple tool calls are added
  // to the same message. Otherwise shallow compare.
  return !nextProps.isLast && prevProps.message === nextProps.message
})
