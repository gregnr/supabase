'use client'

import { Button } from '@ui/components/shadcn/ui/button'
import { Message, UseChatOptions, nanoid } from 'ai'
import { useChat } from 'ai/react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDown, ArrowUp, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AiIconAnimation } from 'ui'
import { TablesData, useTablesQuery } from '~/data/tables/tables-query'
import { useAutoScroll, useReportSuggestions } from '~/lib/hooks'
import ChatMessage from './chat-message'

export function getInitialMessages(tables?: TablesData): Message[] {
  return [
    // An artificial tool call containing the DB schema
    // as if it was already called by the LLM
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
  const { reports } = useReportSuggestions({ enabled: brainstormIdeas })

  const { messages, input, setInput, handleInputChange, append, stop, isLoading } = useChat({
    id: 'main',
    api: 'api/chat',
    maxToolRoundtrips: 10,
    onToolCall,
    initialMessages,
  })

  const { ref: scrollRef, isSticky, scrollToEnd } = useAutoScroll({ enabled: isLoading })

  // Scroll to end when chat is first mounted
  useEffect(() => {
    scrollToEnd('instant')
  }, [scrollToEnd])

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when LLM starts responding (for cases when it wasn't focused prior)
  useEffect(() => {
    if (isLoading) {
      inputRef.current?.focus()
    }
  }, [isLoading])

  const lastMessage = messages.at(-1)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextMessageId = useMemo(() => nanoid(), [messages])

  return (
    <div className="h-full flex flex-col items-stretch">
      <div className="flex-1 relative h-full min-h-0">
        <div className="h-full flex flex-col items-center overflow-y-auto" ref={scrollRef}>
          {messages.some((message) => message.role === 'user') ? (
            <div className="flex flex-col gap-4 w-full max-w-4xl p-10">
              {messages
                .filter(
                  (message) =>
                    message.content ||
                    // Don't include tool calls that don't have an associated UI
                    !message.toolInvocations?.every(
                      (t) => !['generateChart', 'executeSql'].includes(t.toolName)
                    )
                )
                .map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
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
                            onMouseDown={() =>
                              append({ role: 'user', content: report.description })
                            }
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
        <AnimatePresence>
          {!isSticky && (
            <m.div
              className="absolute bottom-5 left-1/2"
              variants={{
                hidden: { scale: 0 },
                show: { scale: 1 },
              }}
              transition={{ duration: 0.1 }}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              <Button
                className="rounded-full w-8 h-8 p-1.5 text-neutral-50 bg-neutral-900"
                onClick={() => {
                  scrollToEnd(isLoading ? 'instant' : 'smooth')
                  inputRef.current?.focus()
                }}
              >
                <ArrowDown />
              </Button>
            </m.div>
          )}
        </AnimatePresence>
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

            // Scroll to bottom after the message has rendered
            setTimeout(() => {
              scrollToEnd('smooth')
            }, 0)
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
            ref={inputRef}
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
            className="rounded-full w-8 h-8 p-1.5 text-neutral-50 bg-neutral-800"
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
