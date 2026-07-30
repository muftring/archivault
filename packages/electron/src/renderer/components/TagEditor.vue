<script setup lang="ts">
import { ref } from 'vue';
import { X } from '@lucide/vue';

const props = defineProps<{ tags: string[]; disabled?: boolean }>();
const emit = defineEmits<{ add: [tag: string]; remove: [tag: string] }>();

const value = ref('');

function submit() {
  const tag = value.value.trim();
  if (tag && !props.tags.includes(tag)) emit('add', tag);
  value.value = '';
}
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-1.5">
      <span v-for="tag in tags" :key="tag" class="badge gap-1 bg-accent/10 text-accent dark:bg-accent/20">
        {{ tag }}
        <button
          type="button"
          class="rounded-full hover:bg-black/10"
          :disabled="disabled"
          :aria-label="`Remove tag ${tag}`"
          @click="emit('remove', tag)"
        >
          <X :size="12" />
        </button>
      </span>
      <span v-if="tags.length === 0" class="text-sm text-zinc-400">No tags</span>
    </div>
    <div class="mt-2 flex gap-2">
      <input
        v-model="value"
        class="input flex-1"
        placeholder="Add a tag…"
        :disabled="disabled"
        @keydown.enter="submit"
      />
      <button type="button" class="btn-secondary" :disabled="disabled || !value.trim()" @click="submit">Add</button>
    </div>
  </div>
</template>
