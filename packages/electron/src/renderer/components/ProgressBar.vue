<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ loaded: number; total: number; label?: string }>();

const pct = computed(() => (props.total > 0 ? Math.min(100, Math.round((props.loaded / props.total) * 100)) : 0));
</script>

<template>
  <div>
    <div v-if="label" class="mb-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{{ label }}</div>
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
      <div class="h-full rounded-full bg-accent transition-all" :style="{ width: pct + '%' }" />
    </div>
  </div>
</template>
