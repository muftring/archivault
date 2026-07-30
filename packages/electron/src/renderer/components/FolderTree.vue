<script setup lang="ts">
import { ref } from 'vue';
import { useFolderChildren } from '../composables/useArchivaultApi';
import FolderTreeNode from './FolderTreeNode.vue';

defineProps<{ currentPath: string | null }>();
const emit = defineEmits<{ navigate: [path: string] }>();

const { data: rootListing, isLoading } = useFolderChildren(ref(null));
</script>

<template>
  <nav class="p-2">
    <p v-if="isLoading" class="px-2 py-1 text-sm text-zinc-400">Loading…</p>
    <p v-else-if="(rootListing?.folders.length ?? 0) === 0" class="px-2 py-1 text-sm text-zinc-400">
      Nothing archived yet.
    </p>
    <FolderTreeNode
      v-for="folder in rootListing?.folders ?? []"
      :key="folder.path"
      :entry="folder"
      :depth="0"
      :current-path="currentPath"
      @navigate="(path) => emit('navigate', path)"
    />
  </nav>
</template>
