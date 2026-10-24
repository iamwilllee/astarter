import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from 'cn'
import { controlVariants, type ControlSize } from './control'
import { useHydrated } from '@/lib/use-hydrated'

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: ControlSize
  htmlSize?: number
}

function Input({ className, type, size = 'default', htmlSize, ...props }: InputProps) {
  const hydrated = useHydrated()
  return (
    <InputPrimitive
      type={type}
      size={htmlSize}
      data-slot="input"
      data-size={size}
      className={cn(
        controlVariants({ size }),
        'block file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  )
}

export { Input }
