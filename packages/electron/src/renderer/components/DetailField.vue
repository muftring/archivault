<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div>
    <div class="label">{{ label }}</div>
    <div class="break-all text-sm text-zinc-700 dark:text-zinc-200"><slot /></div>
  </div>
</template>
