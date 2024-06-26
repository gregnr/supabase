import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/components/shadcn/ui/accordion'
import { DatabaseZap } from 'lucide-react'
import { CodeBlock, cn } from 'ui'

export type CodeAccordionProps = {
  title: string
  language: 'sql'
  code: string
}

export default function CodeAccordion({ title, language, code }: CodeAccordionProps) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value="item-1"
        className="border-2 border-neutral-100 bg-neutral-50 px-3 py-2 rounded-md"
      >
        <AccordionTrigger className="p-0 gap-2">
          <div className="flex gap-2 items-center font-normal text-lighter text-sm">
            <DatabaseZap size={14} />
            {title}
          </div>
        </AccordionTrigger>
        <AccordionContent className="py-2 [&_>div]:pb-0">
          <CodeBlock
            className={cn(`language-${language}`, 'border-none px-0 pb-4 !bg-inherit')}
            hideLineNumbers
            hideCopy
          >
            {code}
          </CodeBlock>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
