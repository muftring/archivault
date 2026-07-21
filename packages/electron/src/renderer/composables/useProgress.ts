import { onUnmounted, ref, watch, type Ref } from 'vue';
import type { DownloadProgress, UploadBatchProgress, VerifyProgress } from '../lib/types';

function useIpcEvent<T>(channel: string, active: Ref<boolean>): Ref<T | null> {
  const payload = ref<T | null>(null) as Ref<T | null>;
  let listener: ((...args: unknown[]) => void) | null = null;

  function detach() {
    if (listener) {
      window.archivault.off(channel, listener);
      listener = null;
    }
  }

  watch(
    active,
    (isActive) => {
      if (isActive) {
        detach();
        listener = (...args: unknown[]) => {
          payload.value = args[0] as T;
        };
        window.archivault.on(channel, listener);
      } else {
        detach();
        payload.value = null;
      }
    },
    { immediate: true }
  );

  onUnmounted(detach);

  return payload;
}

export function useUploadProgress(active: Ref<boolean>): Ref<UploadBatchProgress | null> {
  return useIpcEvent<UploadBatchProgress>('uploadBatch:progress', active);
}

export function useDownloadProgress(active: Ref<boolean>): Ref<DownloadProgress | null> {
  return useIpcEvent<DownloadProgress>('download:progress', active);
}

export function useVerifyProgress(active: Ref<boolean>): Ref<VerifyProgress | null> {
  return useIpcEvent<VerifyProgress>('verify:progress', active);
}
