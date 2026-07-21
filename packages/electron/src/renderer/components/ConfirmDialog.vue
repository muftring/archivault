<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }>(),
  { confirmLabel: 'Confirm', danger: false }
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click="emit('cancel')">
    <div class="panel w-full max-w-sm p-5" @click.stop>
      <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{{ title }}</h3>
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ message }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-secondary" @click="emit('cancel')">Cancel</button>
        <button :class="danger ? 'btn-danger' : 'btn-primary'" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
