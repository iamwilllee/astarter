import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { controlVariants } from './control'

function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(controlVariants({ size: null }), 'block min-h-24 resize-y py-2', className)}
      {...props}
    />
  )
}

export { Textarea }
