import type { ReactNode } from 'react'
import { Toast as Primitive } from '@base-ui/react/toast'
import { CheckCircle2, Info, X } from 'lucide-react'
import { Button } from './button'
import { useToast } from './use-toast'

export function ToastProvider({
  children,
  dismissLabel,
  regionLabel,
}: {
  children: ReactNode
  dismissLabel: string
  regionLabel: string
}) {
  return (
    <Primitive.Provider timeout={5000} limit={3}>
      {children}
      <Toasts dismissLabel={dismissLabel} regionLabel={regionLabel} />
    </Primitive.Provider>
  )
}

function Toasts({ dismissLabel, regionLabel }: { dismissLabel: string; regionLabel: string }) {
  const { toasts } = useToast()
  return (
    <Primitive.Portal>
      <Primitive.Viewport
        aria-label={regionLabel}
        className="fixed bottom-4 right-4 z-70 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none sm:bottom-6 sm:right-6"
      >
        {toasts.map((toast) => (
          <Primitive.Root
            key={toast.id}
            toast={toast}
            className="flex items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg data-limited:hidden"
          >
            <span className="mt-0.5 shrink-0 text-primary">
              {toast.type === 'success' ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <Info className="size-5" />
              )}
            </span>
            <Primitive.Content className="min-w-0 flex-1">
              <Primitive.Title className="break-words text-sm font-medium" />
              <Primitive.Description className="mt-1 break-words text-xs leading-5 text-muted-foreground" />
            </Primitive.Content>
            <Primitive.Close
              aria-hidden={false}
              render={<Button variant="ghost" size="icon-sm" aria-label={dismissLabel} />}
            >
              <X />
            </Primitive.Close>
          </Primitive.Root>
        ))}
      </Primitive.Viewport>
    </Primitive.Portal>
  )
}
