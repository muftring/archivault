<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status: string | null }>();

const STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  deleted: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

const cls = computed(() => STYLES[props.status ?? 'active'] ?? STYLES.active);
</script>

<template>
  <span class="badge" :class="cls">{{ status ?? 'active' }}</span>
</template>
