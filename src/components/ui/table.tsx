import type { ComponentProps } from 'react'
import { cn } from 'cn'

function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative max-w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-left text-sm', className)}
        {...props}
      />
    </div>
  )
}
function TableHeader(props: ComponentProps<'thead'>) {
  return <thead className="border-b bg-muted/40 text-xs text-muted-foreground" {...props} />
}
function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody className="divide-y" {...props} />
}
function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-muted/40 data-selected:bg-accent/50', className)}
      {...props}
    />
  )
}
function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn('whitespace-nowrap px-5 py-3 font-medium', className)}
      {...props}
    />
  )
}
function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-5 py-4 align-middle', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
