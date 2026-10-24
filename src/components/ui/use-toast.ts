import { Toast } from '@base-ui/react/toast'

// Request-local React context; do not create a global toast manager during SSR.
export const useToast = Toast.useToastManager
