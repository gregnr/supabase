'use client'

import { Button } from '@ui/components/shadcn/ui/button'
import { Message, UseChatOptions, nanoid } from 'ai'
import { useChat } from 'ai/react'
import { AnimatePresence, m } from 'framer-motion'
import { throttle } from 'lodash'
import { ArrowUp, Square } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Chart as ChartWrapper } from 'react-chartjs-2'
import { ErrorBoundary } from 'react-error-boundary'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { AiIconAnimation, markdownComponents } from 'ui'
import { TablesData, useTablesQuery } from '~/data/tables/tables-query'
import { db } from '~/lib/db'
import { useReportSuggestions } from '~/lib/hooks'

export function getInitialMessages(tables?: TablesData): Message[] {
  return [
    {
      id: nanoid(),
      role: 'assistant',
      content: '',
      toolInvocations: [
        {
          toolCallId: nanoid(),
          toolName: 'getDatabaseSchema',
          args: {},
          result: tables,
        },
      ],
    },
  ]
}

export type ChatProps = {
  onToolCall: UseChatOptions['onToolCall']
}

export default function Chat({ onToolCall }: ChatProps) {
  const { data: tables } = useTablesQuery({ schemas: ['public'], includeColumns: true })

  const initialMessages = useMemo(() => getInitialMessages(tables), [tables])

  const [brainstormIdeas] = useState(false) // temporarily turn off for now
  const { reports } = useReportSuggestions(db, { enabled: brainstormIdeas })

  const { messages, input, setInput, handleInputChange, append, stop, isLoading } = useChat({
    id: 'main',
    api: 'api/chat',
    maxToolRoundtrips: 10,
    onToolCall,
    // Provide the LLM with the current schema before the chat starts
    initialMessages,
  })

  const lastMessage = messages.at(-1)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextMessageId = useMemo(() => nanoid(), [messages])

  const scrollRef = useRef<HTMLDivElement>()

  const scrollToBottom = useCallback(() => {
    const scrollElement = scrollRef.current
    if (scrollElement) {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'instant',
      })
    }
  }, [])

  const scrollDivRef = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      scrollRef.current = element

      const debounceScroll = throttle((top: number) => {
        element.scrollTo({
          top,
          behavior: 'instant',
        })
      }, 500)

      let prevScrollHeight: number

      const resizeObserver = new ResizeObserver(() => {
        if (element.scrollHeight !== prevScrollHeight) {
          prevScrollHeight = element.scrollHeight

          debounceScroll(element.scrollHeight - element.clientHeight)
        }
      })

      for (const child of Array.from(element.children)) {
        resizeObserver.observe(child)
      }
    }
  }, [])

  return (
    <div className="h-full flex flex-col items-stretch">
      <div className="flex-1 flex flex-col items-center overflow-y-auto" ref={scrollDivRef}>
        {messages.some((message) => message.role === 'user') ? (
          <div className="flex flex-col gap-4 w-full max-w-4xl p-10">
            {messages
              .filter(
                (message) =>
                  message.content ||
                  // Don't include tool calls that don't have an associated UI
                  !message.toolInvocations?.every((t) => t.toolName !== 'generateChart')
              )
              .map((message) => {
                switch (message.role) {
                  case 'user':
                    return (
                      <m.div
                        key={message.id}
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
                      <div
                        key={message.id}
                        className="ml-4 self-stretch flex flex-col items-stretch gap-6"
                      >
                        {message.content && (
                          <ReactMarkdown
                            remarkPlugins={[
                              remarkGfm,
                              [remarkMath, { singleDollarTextMath: false }],
                            ]}
                            rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                            components={{ ...markdownComponents, img: () => null }}
                            className="prose [&_.katex-display>.katex]:text-left"
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                        {message.toolInvocations?.map((toolInvocation) => {
                          switch (toolInvocation.toolName) {
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
                                    <ChartWrapper
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
              })}
            <AnimatePresence>
              {isLoading && (
                <m.div
                  className="-translate-x-8 flex gap-4 justify-start items-center"
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1 },
                  }}
                  initial="hidden"
                  animate="show"
                  exit="hidden"
                >
                  <m.div layoutId="ai-loading-icon">
                    <AiIconAnimation loading />
                  </m.div>
                  {lastMessage &&
                    (lastMessage.role === 'user' ||
                      (lastMessage.role === 'assistant' && !lastMessage.content)) && (
                      <m.div
                        layout
                        className="text-neutral-400 italic"
                        variants={{
                          hidden: { opacity: 0 },
                          show: { opacity: 1, transition: { delay: 1.5 } },
                        }}
                        initial="hidden"
                        animate="show"
                      >
                        Working on it...
                      </m.div>
                    )}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 w-full max-w-4xl flex flex-col gap-10 justify-center items-center">
            <m.h3 layout className="text-2xl font-light">
              What would you like to create?
            </m.h3>
            <div>
              {brainstormIdeas && (
                <>
                  {reports ? (
                    <m.div
                      className="flex flex-row gap-6 flex-wrap justify-center items-start"
                      variants={{
                        show: {
                          transition: {
                            staggerChildren: 0.05,
                          },
                        },
                      }}
                      initial="hidden"
                      animate="show"
                    >
                      {reports.map((report) => (
                        <m.div
                          key={report.name}
                          layoutId={`report-suggestion-${report.name}`}
                          className="w-64 h-32 flex flex-col overflow-ellipsis rounded-md cursor-pointer"
                          onMouseDown={() => append({ role: 'user', content: report.description })}
                          variants={{
                            hidden: { scale: 0 },
                            show: { scale: 1 },
                          }}
                        >
                          <div className="p-4 bg-neutral-200 text-sm rounded-t-md text-neutral-600 font-bold text-center">
                            {report.name}
                          </div>
                          <div className="flex-1 p-4 flex flex-col justify-center border border-neutral-200 text-neutral-500 text-xs font-normal italic rounded-b-md text-center overflow-hidden">
                            {report.description}
                          </div>
                        </m.div>
                      ))}
                    </m.div>
                  ) : (
                    <m.div
                      className="flex flex-row gap-4 justify-center items-center"
                      variants={{
                        hidden: {
                          opacity: 0,
                          y: -10,
                        },
                        show: {
                          opacity: 1,
                          y: 0,
                          transition: {
                            delay: 0.5,
                          },
                        },
                      }}
                      initial="hidden"
                      animate="show"
                    >
                      <m.div layoutId="ai-loading-icon">
                        <AiIconAnimation loading />
                      </m.div>
                      <h3 className="text-lg italic font-light text-neutral-500">
                        Brainstorming some ideas
                      </h3>
                    </m.div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 pb-2 relative">
        <form
          className="flex items-center py-2 px-3 rounded-full bg-neutral-100 w-full max-w-4xl"
          onSubmit={(e) => {
            // Manually manage message submission so that we can control its ID
            // We want to control the ID so that we can perform layout animations via `layoutId`
            // (see hidden dummy message above)
            e.preventDefault()
            append({
              id: nextMessageId,
              role: 'user',
              content: input,
            })
            setInput('')
            scrollToBottom()
          }}
        >
          {/*
           * This is a hidden dummy message acting as an animation anchor
           * before the real message is added to the chat.
           *
           * The animation starts in this element's position and moves over to
           * the location of the real message after submit.
           *
           * It works by sharing the same `layoutId` between both message elements
           * which framer motion requires to animate between them.
           */}
          {input && (
            <m.div
              layoutId={nextMessageId}
              className="absolute invisible -top-12 px-5 py-2.5 text-base rounded-full bg-neutral-100"
            >
              {input}
            </m.div>
          )}
          <input
            id="input"
            name="prompt"
            autoComplete="off"
            className="flex-grow border-none focus-visible:ring-0 text-base bg-inherit placeholder:text-neutral-400"
            value={input}
            onChange={handleInputChange}
            placeholder="Message Supabase AI"
            autoFocus
          />
          <Button
            className="rounded-full w-8 h-8 p-1.5 text-white bg-neutral-800"
            type="submit"
            onClick={(e) => {
              if (isLoading) {
                e.preventDefault()
                stop()
              }
            }}
            disabled={!isLoading && !input}
          >
            {isLoading ? (
              <Square fill="white" strokeWidth={0} className="w-3.5 h-3.5" />
            ) : (
              <ArrowUp />
            )}
          </Button>
        </form>
        <div className="text-xs text-neutral-500">
          AI can make mistakes. Check important information.
        </div>
      </div>
    </div>
  )
}
