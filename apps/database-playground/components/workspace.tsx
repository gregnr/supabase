import { useBreakpoint } from 'common'
import { LazyMotion } from 'framer-motion'
import { useOnToolCall } from '~/lib/hooks'
import Chat from './chat'
import IDE from './ide'

const loadFramerFeatures = () => import('./framer-features').then((res) => res.default)

export type WorkspaceProps = {
  databaseId: string
  onStart?: () => void
}

export default function Workspace({ databaseId, onStart }: WorkspaceProps) {
  const isSmallBreakpoint = useBreakpoint('lg')
  const onToolCall = useOnToolCall(databaseId)

  return (
    <LazyMotion features={loadFramerFeatures}>
      <div className="w-full h-full flex flex-col lg:flex-row p-6 gap-8">
        <IDE databaseId={databaseId}>
          <Chat databaseId={databaseId} onToolCall={onToolCall} onStart={onStart} />
        </IDE>
        {!isSmallBreakpoint && (
          <div className="flex-1 h-full overflow-x-auto">
            <Chat databaseId={databaseId} onToolCall={onToolCall} onStart={onStart} />
          </div>
        )}
      </div>
    </LazyMotion>
  )
}
