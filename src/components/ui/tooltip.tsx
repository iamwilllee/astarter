import { Tooltip as Primitive } from '@base-ui/react/tooltip'
import { cn } from 'cn'
import { createContext, useContext, useId } from 'react'

const TooltipProvider = Primitive.Provider
const TooltipId = createContext<string | undefined>(undefined)

function Tooltip({ children, ...props }: Primitive.Root.Props) {
  const id = useId()
  return (
    <TooltipId.Provider value={id}>
      <Primitive.Root {...props}>{children}</Primitive.Root>
    </TooltipId.Provider>
  )
}

function TooltipTrigger(props: Primitive.Trigger.Props) {
  const id = useContext(TooltipId)
  return (
    <Primitive.Trigger
      {...props}
      aria-describedby={[props['aria-describedby'], id].filter(Boolean).join(' ') || undefined}
    />
  )
}

function TooltipContent({
  className,
  ...props
}: Omit<Primitive.Popup.Props, 'className'> & { className?: string }) {
  const id = useContext(TooltipId)
  return (
    <Primitive.Portal>
      <Primitive.Positioner sideOffset={8} className="z-60">
        <Primitive.Popup
          data-slot="tooltip-content"
          className={cn(
            'max-w-64 rounded-md bg-foreground px-3 py-2 text-xs leading-5 text-background shadow-md',
            className,
          )}
          {...props}
          id={id}
          role="tooltip"
        />
      </Primitive.Positioner>
    </Primitive.Portal>
  )
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
