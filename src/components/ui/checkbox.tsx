import { Checkbox as Primitive } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from 'cn'
import { useHydrated } from '@/lib/use-hydrated'

function Checkbox({
  className,
  ...props
}: Omit<Primitive.Root.Props, 'className'> & { className?: string }) {
  const hydrated = useHydrated()
  return (
    <Primitive.Root
      data-slot="checkbox"
      className={cn(
        'group/checkbox flex size-5 shrink-0 items-center justify-center rounded border border-input bg-background outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    >
      <Primitive.Indicator>
        <Check className="size-3.5 group-data-indeterminate/checkbox:hidden" />
        <Minus className="hidden size-3.5 group-data-indeterminate/checkbox:block" />
      </Primitive.Indicator>
    </Primitive.Root>
  )
}

export { Checkbox }
