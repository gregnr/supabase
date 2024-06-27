import { useQuery, useQueryClient } from '@tanstack/react-query'
import { nanoid } from 'ai'
import { useChat } from 'ai/react'
import { codeBlock } from 'common-tags'
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTablesQuery } from '~/data/tables/tables-query'
import { Report } from '~/lib/schema'
import { SmoothScroller } from './smooth-scroller'

export type UseReportSuggestionsOptions = {
  enabled?: boolean
}

export function useReportSuggestions({ enabled = true }: UseReportSuggestionsOptions = {}) {
  const { data: tables } = useTablesQuery({ schemas: ['public'], includeColumns: true })
  const [reports, setReports] = useState<Report[]>()

  const { append, setMessages } = useChat({
    api: 'api/chat',
    async onToolCall({ toolCall }) {
      switch (toolCall.toolName) {
        case 'brainstormReports': {
          const { reports } = toolCall.args as any
          setReports(reports)
        }
      }
    },
  })

  useEffect(() => {
    if (enabled && tables) {
      // Provide the LLM with the current schema before invoking the tool call
      setMessages([
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
      ])

      append({
        role: 'user',
        content: codeBlock`
        Brainstorm 5 interesting charts that can be generated based on tables and their columns in the database.

        Keep descriptions short and concise. Don't say "eg.". Descriptions should mention charting or visualizing.

        Titles should be 4 words or less.
      `,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tables])

  return { reports }
}

/**
 * Hook to load/store values from local storage with an API similar
 * to `useState()`.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const queryClient = useQueryClient()
  const queryKey = ['local-storage', key]

  const { data: storedValue = initialValue } = useQuery({
    queryKey,
    queryFn: () => {
      if (typeof window === 'undefined') {
        return initialValue
      }

      const item = window.localStorage.getItem(key)

      if (!item) {
        return initialValue
      }

      return JSON.parse(item) as T
    },
  })

  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    }

    queryClient.setQueryData(queryKey, valueToStore)
    queryClient.invalidateQueries({ queryKey })
  }

  return [storedValue, setValue] as const
}

export function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export type UseAutoScrollProps = {
  enabled?: boolean
}

/**
 * Automatically scroll a container to the bottom as new
 * content is added to it.
 */
export function useAutoScroll({ enabled = true }: UseAutoScrollProps = {}) {
  // Store container element in state so that we can
  // mount/dismount handlers via `useEffect` (see below)
  const [container, setContainer] = useState<HTMLDivElement>()

  const scroller = useMemo(() => {
    if (container) {
      return new SmoothScroller(container)
    }
  }, [container])

  // Maintain `isSticky` state for the consumer to access
  const [isSticky, setIsSticky] = useState(true)

  // Maintain `isStickyRef` value for internal use
  // that isn't limited to React's state lifecycle
  const isStickyRef = useRef(isSticky)

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      setContainer(element)
    }
  }, [])

  // Convenience function to allow consumers to
  // scroll to the bottom of the container
  const scrollToEnd = useCallback(() => {
    if (container && scroller) {
      isStickyRef.current = true

      // Update state so that consumers can hook into sticky status
      setIsSticky(isStickyRef.current)

      // TODO: support duration greater than 0
      scroller.scrollTo(container.scrollHeight - container.clientHeight, 0)
    }
  }, [container, scroller])

  useEffect(() => {
    let resizeObserver: ResizeObserver | undefined
    let mutationObserver: MutationObserver | undefined
    let lastScrollTop: number
    let lastScrollHeight: number

    function onScrollStart(e: Event) {
      if (container && scroller) {
        // TODO: understand where these phantom scroll/height changes occur
        if (lastScrollHeight !== undefined && container.scrollHeight !== lastScrollHeight) {
          return
        }

        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight
        const hasScrolledUp = container.scrollTop < lastScrollTop

        if (hasScrolledUp) {
          scroller.cancel()
        }

        // We're sticky if we're in the middle of an automated scroll
        // or if the user manually scrolled to the bottom
        isStickyRef.current = !hasScrolledUp && (scroller.isAnimating || isAtBottom)

        // Update state so that consumers can hook into sticky status
        setIsSticky(isStickyRef.current)
      }
    }

    if (container) {
      container.addEventListener('scroll', onScrollStart)

      if (enabled) {
        // Scroll when the container's children resize
        resizeObserver = new ResizeObserver(() => {
          lastScrollTop = container.scrollTop
          lastScrollHeight = container.scrollHeight

          if (isStickyRef.current) {
            scrollToEnd()
          }
        })

        // Monitor the size of the children within the scroll container
        for (const child of Array.from(container.children)) {
          resizeObserver.observe(child)
        }
      }
    }

    return () => {
      container?.removeEventListener('scroll', onScrollStart)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [container, scroller, scrollToEnd, enabled])

  return { ref, isSticky, scrollToEnd }
}
