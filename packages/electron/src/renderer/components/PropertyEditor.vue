<script setup lang="ts">
import { ref } from 'vue';
import { X } from '@lucide/vue';

const props = defineProps<{ properties: Record<string, string>; disabled?: boolean }>();
const emit = defineEmits<{ set: [name: string, value: string]; remove: [name: string] }>();

const name = ref('');
const value = ref('');

function submit() {
  const n = name.value.trim();
  if (!n) return;
  emit('set', n, value.value.trim());
  name.value = '';
  value.value = '';
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-1.5">
      <div
        v-for="[n, v] in Object.entries(properties)"
        :key="n"
        class="flex items-center justify-between rounded-md bg-zinc-100 px-2.5 py-1.5 text-sm dark:bg-zinc-800"
      >
        <span>
          <span class="font-medium text-zinc-700 dark:text-zinc-200">{{ n }}</span>
          <span class="text-zinc-400"> = </span>
          <span class="text-zinc-600 dark:text-zinc-300">{{ v }}</span>
        </span>
        <button
          type="button"
          class="rounded-full p-0.5 hover:bg-black/10"
          :disabled="disabled"
          :aria-label="`Remove property ${n}`"
          @click="emit('remove', n)"
        >
          <X :size="12" />
        </button>
      </div>
      <span v-if="Object.keys(properties).length === 0" class="text-sm text-zinc-400">No properties</span>
    </div>
    <div class="mt-2 flex gap-2">
      <input v-model="name" class="input w-1/3" placeholder="name" :disabled="disabled" />
      <input v-model="value" class="input flex-1" placeholder="value" :disabled="disabled" @keydown.enter="submit" />
      <button type="button" class="btn-secondary" :disabled="disabled || !name.trim()" @click="submit">Set</button>
    </div>
  </div>
</template>
