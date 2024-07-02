'use client'

import 'chart.js/auto'
import 'chartjs-adapter-date-fns'

import { PopoverClose } from '@radix-ui/react-popover'
import { Button } from '@ui/components/shadcn/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/shadcn/ui/popover'
import { CircleEllipsis, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PropsWithChildren, useState } from 'react'
import { cn } from 'ui'
import { useDatabaseCreateMutation } from '~/data/databases/database-create-mutation'
import { useDatabaseDeleteMutation } from '~/data/databases/database-delete-mutation'
import { useDatabasesQuery } from '~/data/databases/databases-query'
import { Database } from '~/lib/db'

export type LayoutProps = PropsWithChildren

export default function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const { data: databases } = useDatabasesQuery()
  const { mutateAsync: createDatabase } = useDatabaseCreateMutation()
  let { id: currentDatabaseId } = useParams<{ id: string }>()

  return (
    <div className="w-full h-full flex flex-col lg:flex-row p-6 gap-8">
      <div className="flex flex-col items-stretch w-48">
        <Button
          className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
          onClick={async () => {
            const { id } = await createDatabase()
            router.push(`/d/${id}`)
          }}
        >
          + New database
        </Button>
        {databases?.map((database) => (
          <DatabaseMenuItem
            key={database.id}
            database={database}
            isActive={database.id === currentDatabaseId}
          />
        ))}
      </div>
      {children}
    </div>
  )
}

type DatabaseMenuItemProps = {
  database: Database
  isActive: boolean
}

function DatabaseMenuItem({ database, isActive }: DatabaseMenuItemProps) {
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
          <PopoverClose asChild>
            <Button
              className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3"
              onClick={async (e) => {
                e.preventDefault()
                await deleteDatabase({ id: database.id })
              }}
            >
              <Trash2 size={16} strokeWidth={2} className="flex-shrink-0 text-light" />

              <span>Delete</span>
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </Link>
  )
}
