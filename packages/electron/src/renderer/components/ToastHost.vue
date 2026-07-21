<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts } = useToast();
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="pointer-events-auto rounded-md px-4 py-2 text-sm text-white shadow-lg"
      :class="t.variant === 'success' ? 'bg-emerald-600' : t.variant === 'error' ? 'bg-red-600' : 'bg-zinc-800'"
    >
      {{ t.message }}
    </div>
  </div>
</template>
