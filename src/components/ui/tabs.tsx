import { Tabs as Primitive } from '@base-ui/react/tabs'
import { cn } from 'cn'
import { useHydrated } from '@/lib/use-hydrated'

const Tabs = Primitive.Root

function TabsList({
  className,
  ...props
}: Omit<Primitive.List.Props, 'className'> & { className?: string }) {
  return (
    <Primitive.List
      data-slot="tabs-list"
      className={cn(
        'flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/60 p-1',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: Omit<Primitive.Tab.Props, 'className'> & { className?: string }) {
  const hydrated = useHydrated()
  return (
    <Primitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex min-h-(--control-sm) shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-active:bg-card data-active:text-foreground data-active:shadow-sm [&_svg]:size-4',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  )
}

function TabsContent({
  className,
  ...props
}: Omit<Primitive.Panel.Props, 'className'> & { className?: string }) {
  return (
    <Primitive.Panel
      data-slot="tabs-content"
      className={cn(
        'min-w-0 pt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
