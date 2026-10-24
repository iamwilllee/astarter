import { Menu as Primitive } from '@base-ui/react/menu'
import { cn } from 'cn'

const DropdownMenu = Primitive.Root
// Compose with render={<Button ... />} to share geometry and hydration handling.
const DropdownMenuTrigger = Primitive.Trigger

function DropdownMenuContent({
  className,
  ...props
}: Omit<Primitive.Popup.Props, 'className'> & { className?: string }) {
  return (
    <Primitive.Portal>
      <Primitive.Positioner align="end" sideOffset={6} className="z-50 outline-none">
        <Primitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'max-h-(--available-height) min-w-44 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none',
            className,
          )}
          {...props}
        />
      </Primitive.Positioner>
    </Primitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: Omit<Primitive.Item.Props, 'className'> & { className?: string; destructive?: boolean }) {
  return (
    <Primitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex min-h-(--control-md) cursor-default items-center gap-2 rounded-md px-3 py-1.5 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:size-4',
        destructive &&
          'text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator(props: Primitive.Separator.Props) {
  return <Primitive.Separator className="my-1 h-px bg-border" {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
