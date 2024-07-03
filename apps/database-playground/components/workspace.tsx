import { CreateMessage, Message, useChat } from 'ai/react'
import { useBreakpoint } from 'common'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useMessageCreateMutation } from '~/data/messages/message-create-mutation'
import { useMessagesQuery } from '~/data/messages/messages-query'
import { useTablesQuery } from '~/data/tables/tables-query'
import { useOnToolCall } from '~/lib/hooks'
import { ensureMessageId } from '~/lib/util'
import Chat, { getInitialMessages } from './chat'
import IDE from './ide'

export type WorkspaceProps = {
  databaseId: string
  onStart?: () => void
}

export default function Workspace({ databaseId, onStart }: WorkspaceProps) {
  const isSmallBreakpoint = useBreakpoint('lg')
  const onToolCall = useOnToolCall(databaseId)
  const { mutateAsync: saveMessage } = useMessageCreateMutation(databaseId)

  const { data: tables, isLoading: isLoadingSchema } = useTablesQuery({
    databaseId,
    schemas: ['public'],
  })
  const { data: existingMessages, isLoading: isLoadingMessages } = useMessagesQuery(databaseId)

  const initialMessages = useMemo(() => (tables ? getInitialMessages(tables) : undefined), [tables])

  const {
    messages,
    append,
    stop: stopReply,
  } = useChat({
    id: databaseId,
    api: '/api/chat',
    maxToolRoundtrips: 10,
    onToolCall: onToolCall as any, // our `OnToolCall` type is more specific then `ai` SDK's
    initialMessages:
      existingMessages && existingMessages.length > 0 ? existingMessages : initialMessages,
    async onFinish(message) {
      await saveMessage({ message })
      await onStart?.()
    },
  })

  const appendMessage = useCallback(
    async (message: Message | CreateMessage) => {
      ensureMessageId(message)
      append(message)
      saveMessage({ message })
    },
    [saveMessage, append]
  )

  // const isLoadingMessages = messages.length === 0 && isExistingMessagesLoading
  const isConversationStarted =
    initialMessages !== undefined && messages.length > initialMessages.length

  return (
    <WorkspaceContext.Provider
      value={{
        databaseId,
        isLoadingMessages,
        isLoadingSchema,
        isConversationStarted,
        messages,
        appendMessage,
        stopReply,
      }}
    >
      <div className="w-full h-full flex flex-col lg:flex-row p-6 gap-8">
        <IDE>
          <Chat />
        </IDE>
        {!isSmallBreakpoint && (
          <div className="flex-1 h-full overflow-x-auto">
            <Chat />
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  )
}

export type WorkspaceContextValues = {
  databaseId: string
  isLoadingMessages: boolean
  isLoadingSchema: boolean
  isConversationStarted: boolean
  messages: Message[]
  appendMessage(message: Message | CreateMessage): Promise<void>
  stopReply(): void
}

export const WorkspaceContext = createContext<WorkspaceContextValues | undefined>(undefined)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error(
      'WorkspaceContext missing. Are you accessing useWorkspace() outside of a Workspace?'
    )
  }

  return context
}
