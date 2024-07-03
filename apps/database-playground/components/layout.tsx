'use client'

import 'chart.js/auto'
import 'chartjs-adapter-date-fns'

import { Button } from '@ui/components/shadcn/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/shadcn/ui/popover'
import { AnimatePresence, LazyMotion, m } from 'framer-motion'
import { CircleEllipsis, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PropsWithChildren, useState } from 'react'
import { cn } from 'ui'
import { useDatabaseDeleteMutation } from '~/data/databases/database-delete-mutation'
import { useDatabasesQuery } from '~/data/databases/databases-query'
import { Database } from '~/lib/db'

const loadFramerFeatures = () => import('./framer-features').then((res) => res.default)

export type LayoutProps = PropsWithChildren

export default function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const { data: databases } = useDatabasesQuery()
  let { id: currentDatabaseId } = useParams<{ id: string }>()

  return (
    <LazyMotion features={loadFramerFeatures}>
      <div className="w-full h-full flex flex-col lg:flex-row p-6 gap-8">
        <div className="flex flex-col items-stretch w-48">
          <Button
            className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
            onClick={async () => {
              router.push('/')
            }}
          >
            + New database
          </Button>
          <AnimatePresence>
            {databases && (
              <m.div
                className="flex-1 flex flex-col items-stretch max-w-48"
                transition={{ staggerChildren: 0.03 }}
                initial="hidden"
                animate="show"
                exit="hidden"
              >
                {databases.map((database) => (
                  <m.div
                    key={database.id}
                    layout="position"
                    layoutId={`database-menu-item-${database.id}`}
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      show: { opacity: 1, x: 0 },
                    }}
                  >
                    <DatabaseMenuItem
                      database={database}
                      isActive={database.id === currentDatabaseId}
                    />
                  </m.div>
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>
        {children}
      </div>
    </LazyMotion>
  )
}

type DatabaseMenuItemProps = {
  database: Database
  isActive: boolean
}

function DatabaseMenuItem({ database, isActive }: DatabaseMenuItemProps) {
  const router = useRouter()
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const { mutateAsync: deleteDatabase } = useDatabaseDeleteMutation()

  return (
    <Link
      className={cn(
        'group relative bg-inherit justify-start hover:bg-neutral-200 flex gap-3 p-3 rounded-md',
        isActive || isPopoverOpen ? 'bg-neutral-200' : undefined
      )}
      href={`/d/${database.id}`}
    >
      <span>{database.name ?? 'My database'}</span>
      <Popover onOpenChange={(open) => setIsPopoverOpen(open)} open={isPopoverOpen}>
        <PopoverTrigger
          asChild
          onClick={(e) => {
            e.preventDefault()
            setIsPopoverOpen(true)
          }}
        >
          <div
            className={cn(
              'hidden group-hover:flex absolute right-0 top-0 bottom-0 p-2 opacity-50 items-center',
              isActive || isPopoverOpen ? 'flex' : undefined
            )}
          >
            <CircleEllipsis size={24} />
          </div>
        </PopoverTrigger>

        <PopoverContent className="p-2 flex flex-col">
          <Button
            className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
            onClick={async (e) => {
              e.preventDefault()
              setIsPopoverOpen(false)
              await deleteDatabase({ id: database.id })

              if (isActive) {
                router.push('/')
              }
            }}
          >
            <Trash2 size={16} strokeWidth={2} className="flex-shrink-0 text-light" />

            <span>Delete</span>
          </Button>
        </PopoverContent>
      </Popover>
    </Link>
  )
}
