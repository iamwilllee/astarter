import { Switch as Primitive } from '@base-ui/react/switch'
import { cn } from 'cn'
import { useHydrated } from '@/lib/use-hydrated'

function Switch({
  className,
  ...props
}: Omit<Primitive.Root.Props, 'className'> & { className?: string }) {
  const hydrated = useHydrated()
  return (
    <Primitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-input px-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-disabled:opacity-50',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    >
      <Primitive.Thumb className="size-4.5 rounded-full bg-card shadow-sm transition-transform data-checked:translate-x-4 data-checked:bg-primary-foreground" />
    </Primitive.Root>
  )
}

export { Switch }
