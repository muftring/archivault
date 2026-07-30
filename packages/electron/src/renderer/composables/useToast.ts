import { reactive } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

const toasts = reactive<ToastItem[]>([]);
let nextId = 1;

export function useToast() {
  function show(message: string, variant: ToastItem['variant'] = 'info') {
    const id = nextId++;
    toasts.push({ id, message, variant });
    setTimeout(() => {
      const idx = toasts.findIndex((t) => t.id === id);
      if (idx !== -1) toasts.splice(idx, 1);
    }, 4000);
  }

  return { toasts, show };
}
