<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Folder } from '@lucide/vue';
import type { FileWithMeta, FolderEntry } from '../lib/types';
import { formatBytes, formatDate } from '../lib/format';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{
  folders: FolderEntry[];
  files: FileWithMeta[];
  loading: boolean;
}>();
const emit = defineEmits<{ 'enter-folder': [path: string] }>();

const router = useRouter();
</script>

<template>
  <div class="flex-1 overflow-auto">
    <p v-if="loading" class="p-10 text-center text-sm text-zinc-400">Loading…</p>
    <p v-else-if="folders.length === 0 && files.length === 0" class="p-10 text-center text-sm text-zinc-400">
      This folder is empty.
    </p>
    <table v-else class="w-full border-collapse text-sm">
      <thead class="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
        <tr>
          <th
            v-for="h in ['Name', 'Size', 'Uploaded', 'Status']"
            :key="h"
            class="border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          >
            {{ h }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="folder in folders"
          :key="folder.path"
          class="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
          @click="emit('enter-folder', folder.path)"
        >
          <td class="max-w-xs truncate px-3 py-2">
            <span class="flex items-center gap-1.5">
              <Folder :size="14" class="shrink-0 text-accent" />
              {{ folder.name }}
            </span>
          </td>
          <td class="px-3 py-2 text-zinc-500 dark:text-zinc-400">
            {{ folder.itemCount }} item{{ folder.itemCount === 1 ? '' : 's' }}
          </td>
          <td class="px-3 py-2 text-zinc-500 dark:text-zinc-400">—</td>
          <td class="px-3 py-2 text-zinc-500 dark:text-zinc-400">—</td>
        </tr>
        <tr
          v-for="f in files"
          :key="f.id"
          class="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
          @click="router.push(`/files/${f.id}`)"
        >
          <td class="max-w-xs truncate px-3 py-2">{{ f.fileName }}</td>
          <td class="px-3 py-2 text-zinc-500 dark:text-zinc-400">{{ formatBytes(f.fileSize) }}</td>
          <td class="px-3 py-2 text-zinc-500 dark:text-zinc-400">{{ formatDate(f.uploadedAt) }}</td>
          <td class="px-3 py-2">
            <StatusBadge :status="f.status" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
