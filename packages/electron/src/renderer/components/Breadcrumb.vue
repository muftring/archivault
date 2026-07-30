<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight, House } from '@lucide/vue';

const props = defineProps<{ path: string | null }>();
const emit = defineEmits<{ navigate: [path: string | null] }>();

interface Crumb {
  label: string;
  path: string | null;
}

const crumbs = computed<Crumb[]>(() => {
  const segments = props.path ? props.path.split('/') : [];
  const result: Crumb[] = [{ label: 'Home', path: null }];
  segments.forEach((segment, i) => {
    result.push({ label: segment, path: segments.slice(0, i + 1).join('/') });
  });
  return result;
});
</script>

<template>
  <div class="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-300">
    <template v-for="(crumb, i) in crumbs" :key="crumb.path ?? 'home'">
      <ChevronRight v-if="i > 0" :size="14" class="shrink-0 text-zinc-400" />
      <span v-if="i === crumbs.length - 1" class="flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-100">
        <House v-if="i === 0" :size="14" />
        {{ crumb.label }}
      </span>
      <button
        v-else
        type="button"
        class="flex items-center gap-1 rounded px-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        @click="emit('navigate', crumb.path)"
      >
        <House v-if="i === 0" :size="14" />
        {{ crumb.label }}
      </button>
    </template>
  </div>
</template>
