import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from 'cn'
import { controlVariants, type ControlSize } from './control'

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: ControlSize
  htmlSize?: number
}

function Input({ className, type, size = 'default', htmlSize, ...props }: InputProps) {
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
    />
  )
}

export { Input }
