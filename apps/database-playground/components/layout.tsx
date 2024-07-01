'use client'

import 'chart.js/auto'
import 'chartjs-adapter-date-fns'

import { Button } from '@ui/components/shadcn/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { useDatabaseCreateMutation } from '~/data/databases/database-create-mutation'
import { useDatabasesQuery } from '~/data/databases/databases-query'

export type LayoutProps = PropsWithChildren

export default function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const { data: databases } = useDatabasesQuery()
  const { mutateAsync: createDatabase } = useDatabaseCreateMutation()

  return (
    <div className="w-full h-full flex flex-col lg:flex-row p-6 gap-8">
      <div className="flex flex-col items-stretch">
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
          <Link
            key={database.id}
            className="bg-inherit justify-start hover:bg-neutral-200 flex gap-3 p-3 rounded-md"
            href={`/d/${database.id}`}
          >
            {database.name ?? 'My database'}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
