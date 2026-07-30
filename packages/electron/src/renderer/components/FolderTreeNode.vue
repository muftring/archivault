<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from '@lucide/vue';
import { useFolderChildren } from '../composables/useArchivaultApi';
import type { FolderEntry } from '../lib/types';

const props = defineProps<{
  entry: FolderEntry;
  depth: number;
  currentPath: string | null;
}>();
const emit = defineEmits<{ navigate: [path: string] }>();

const expanded = ref(false);

const isAncestorOrSelf = computed(
  () => props.currentPath === props.entry.path || props.currentPath?.startsWith(props.entry.path + '/') === true
);

watch(
  () => props.currentPath,
  () => {
    if (isAncestorOrSelf.value) expanded.value = true;
  },
  { immediate: true }
);

const { data: listing } = useFolderChildren(
  computed(() => props.entry.path),
  expanded
);

function toggleExpanded() {
  expanded.value = !expanded.value;
}

function navigate() {
  expanded.value = true;
  emit('navigate', props.entry.path);
}

function onChildNavigate(path: string) {
  emit('navigate', path);
}
</script>

<template>
  <div>
    <div
      class="flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-sm"
      :class="currentPath === entry.path ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'"
      :style="{ paddingLeft: `${depth * 16 + 4}px` }"
    >
      <button type="button" class="flex h-4 w-4 shrink-0 items-center justify-center" @click.stop="toggleExpanded">
        <ChevronDown v-if="expanded" :size="12" />
        <ChevronRight v-else :size="12" />
      </button>
      <span class="flex flex-1 items-center gap-1.5 truncate" @click="navigate">
        <FolderOpen v-if="expanded" :size="14" class="shrink-0" />
        <Folder v-else :size="14" class="shrink-0" />
        <span class="truncate">{{ entry.name }}</span>
      </span>
    </div>

    <div v-if="expanded">
      <FolderTreeNode
        v-for="child in listing?.folders ?? []"
        :key="child.path"
        :entry="child"
        :depth="depth + 1"
        :current-path="currentPath"
        @navigate="onChildNavigate"
      />
    </div>
  </div>
</template>
