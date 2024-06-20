import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/components/shadcn/ui/accordion'
import { Message } from 'ai'
import { m } from 'framer-motion'
import { DatabaseZap } from 'lucide-react'
import { memo } from 'react'
import { Chart } from 'react-chartjs-2'
import { ErrorBoundary } from 'react-error-boundary'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { CodeBlock, markdownComponents } from 'ui'

export type ChatMessageProps = {
  message: Message
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
      return (
        <div className="ml-4 self-stretch flex flex-col items-stretch gap-6">
          {message.content && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
              rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
              components={{ ...markdownComponents, img: () => null }}
              className="prose [&_.katex-display>.katex]:text-left"
            >
              {message.content}
            </ReactMarkdown>
          )}
          {message.toolInvocations?.map((toolInvocation) => {
            switch (toolInvocation.toolName) {
              case 'executeSql': {
                if (!('result' in toolInvocation)) {
                  return null
                }

                if ('error' in toolInvocation.result) {
                  return (
                    <div
                      key={toolInvocation.toolCallId}
                      className="bg-destructive-300 px-6 py-4 rounded-md"
                    >
                      Error executing SQL
                    </div>
                  )
                }

                const { sql } = toolInvocation.args

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
                          key={toolInvocation.toolCallId}
                          className="language-sql border-none px-0 pb-2 !bg-inherit"
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
                  return undefined
                }

                if ('error' in toolInvocation.result) {
                  return (
                    <div
                      key={toolInvocation.toolCallId}
                      className="bg-destructive-300 px-6 py-4 rounded-md"
                    >
                      Error loading chart
                    </div>
                  )
                }

                const { type, data, options } = toolInvocation.args.config
                return (
                  <ErrorBoundary
                    key={toolInvocation.toolCallId}
                    fallbackRender={() => (
                      <div className="bg-destructive-300 px-6 py-4 rounded-md">
                        Error loading chart
                      </div>
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
            }
          })}
        </div>
      )
  }
}

// Memoizing is important here - otherwise React continually
// re-renders previous messages unnecessarily (big performance hit)
export default memo(ChatMessage)
