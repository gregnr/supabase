'use client'

import 'chart.js/auto'
import 'chartjs-adapter-date-fns'

import { Button } from '@ui/components/shadcn/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/shadcn/ui/popover'
import { LazyMotion, m } from 'framer-motion'
import { CircleEllipsis, PackagePlus, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PropsWithChildren, useState } from 'react'
import { cn } from 'ui'
import { useDatabaseDeleteMutation } from '~/data/databases/database-delete-mutation'
import { useDatabaseUpdateMutation } from '~/data/databases/database-update-mutation'
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
      <div className="w-full h-full flex flex-col lg:flex-row gap-8">
        <div className="max-w-72 w-full h-full flex flex-col gap-2 items-stretch p-4 bg-neutral-100">
          <Button
            className="bg-inherit justify-start hover:bg-neutral-200 text-sm flex gap-3"
            onClick={async () => {
              router.push('/')
            }}
          >
            <PackagePlus /> New database
          </Button>
          {databases && (
            <m.div
              className="flex-1 flex flex-col items-stretch overflow-y-auto"
              transition={{ staggerChildren: 0.03 }}
              initial="hidden"
              animate="show"
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
  const { mutateAsync: updateDatabase } = useDatabaseUpdateMutation()

  const [isRenaming, setIsRenaming] = useState(false)

  return (
    <Link
      data-active={isActive || isPopoverOpen}
      className={cn(
        'group text-sm w-full relative bg-inherit justify-start bg-neutral-100 hover:bg-neutral-200 flex gap-3 p-3 rounded-md overflow-hidden data-[active=true]:bg-neutral-200'
      )}
      href={`/d/${database.id}`}
    >
      <span className="text-nowrap">{database.name ?? 'My database'}</span>
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0',
          'w-8 bg-gradient-to-l from-neutral-100 from-0%',
          'group-hover:w-16 group-hover:from-neutral-200 group-hover:from-50%',
          'group-data-[active=true]:w-16 group-data-[active=true]:from-neutral-200 group-data-[active=true]:from-50%'
        )}
      />
      <Popover
        onOpenChange={(open) => {
          setIsPopoverOpen(open)
          if (!open) {
            setIsRenaming(false)
          }
        }}
        open={isPopoverOpen}
      >
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

        <PopoverContent className="p-2 flex flex-col overflow-hidden w-auto">
          {isRenaming ? (
            <form
              className="w-72"
              onSubmit={async (e) => {
                e.preventDefault()

                if (e.target instanceof HTMLFormElement) {
                  const formData = new FormData(e.target)
                  const name = formData.get('name')

                  if (typeof name === 'string') {
                    await updateDatabase({ ...database, name })
                  }
                }

                setIsPopoverOpen(false)
                setIsRenaming(false)
              }}
            >
              <input
                name="name"
                className="flex-grow w-full border-none focus-visible:ring-0 text-base bg-inherit placeholder:text-neutral-400"
                placeholder={`Rename ${database.name}`}
                defaultValue={database.name ?? undefined}
                autoComplete="off"
                autoFocus
              />
            </form>
          ) : (
            <div className="flex flex-col items-stretch w-32">
              <Button
                className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
                onClick={async (e) => {
                  e.preventDefault()
                  setIsRenaming(true)
                }}
              >
                <Pencil size={16} strokeWidth={2} className="flex-shrink-0" />

                <span>Rename</span>
              </Button>
              <Button
                className="bg-inherit text-destructive-600 justify-start hover:bg-neutral-200 flex gap-3"
                onClick={async (e) => {
                  e.preventDefault()
                  setIsPopoverOpen(false)
                  await deleteDatabase({ id: database.id })

                  if (isActive) {
                    router.push('/')
                  }
                }}
              >
                <Trash2 size={16} strokeWidth={2} className="flex-shrink-0" />

                <span>Delete</span>
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </Link>
  )
}
