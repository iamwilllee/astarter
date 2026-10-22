import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { useHydrated } from '@/lib/use-hydrated'
import { controlVariants, type ControlSize } from './control'

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: Omit<SelectPrimitive.Trigger.Props, 'className'> & {
  className?: string
  size?: ControlSize
}) {
  const hydrated = useHydrated()
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        controlVariants({ size }),
        'flex items-center justify-between gap-2 text-start data-placeholder:text-muted-foreground [&>span]:truncate',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    >
      {children}
      <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  ...props
}: Omit<SelectPrimitive.Popup.Props, 'className'> & { className?: string }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={4}
        align="start"
        alignItemWithTrigger={false}
        className="z-50 outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none',
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: Omit<SelectPrimitive.Item.Props, 'className'> & { className?: string }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex min-h-(--control-md) cursor-default items-center rounded-md py-1.5 pl-3 pr-8 text-base outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground md:text-sm',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
