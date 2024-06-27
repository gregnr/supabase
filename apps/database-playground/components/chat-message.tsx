'use client'

import 'chart.js/auto'

import { Message } from 'ai'
import { m } from 'framer-motion'
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { markdownComponents } from 'ui'
import { ToolUi } from './tools'

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
          className="self-end px-5 py-2.5 text-base rounded-3xl bg-neutral-100 whitespace-pre-wrap"
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
            <ToolUi key={toolInvocation.toolCallId} toolInvocation={toolInvocation as any} />
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

// Memoizing is important here - otherwise React continually
// re-renders previous messages unnecessarily (big performance hit)
export default memo(ChatMessage, (prevProps, nextProps) => {
  // Always re-render the last message to fix a bug where `useChat()`
  // doesn't trigger a re-render when multiple tool calls are added
  // to the same message. Otherwise shallow compare.
  return !nextProps.isLast && prevProps.message === nextProps.message
})
