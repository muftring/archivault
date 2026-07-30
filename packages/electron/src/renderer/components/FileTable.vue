<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { FileWithMeta } from '../lib/types';
import { formatBytes, formatDate } from '../lib/format';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{
  files: FileWithMeta[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
}>();
const emit = defineEmits<{ 'page-change': [page: number] }>();

const router = useRouter();
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const columns = ['Name', 'Size', 'Uploaded', 'Status', 'Tags'];
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="flex-1 overflow-auto">
      <p v-if="loading" class="p-10 text-center text-sm text-zinc-400">Loading…</p>
      <p v-else-if="files.length === 0" class="p-10 text-center text-sm text-zinc-400">
        No files match these filters.
      </p>
      <table v-else class="w-full border-collapse text-sm">
        <thead class="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
          <tr>
            <th
              v-for="h in columns"
              :key="h"
              class="border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            >
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody>
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
            <td class="max-w-xs truncate px-3 py-2 text-zinc-500 dark:text-zinc-400">{{ f.tags.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      class="flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    >
      <span>{{ total }} file{{ total === 1 ? '' : 's' }}</span>
      <div class="flex items-center gap-2">
        <button class="btn-ghost" :disabled="page === 0" @click="emit('page-change', page - 1)">Previous</button>
        <span>Page {{ page + 1 }} of {{ totalPages }}</span>
        <button class="btn-ghost" :disabled="page >= totalPages - 1" @click="emit('page-change', page + 1)">
          Next
        </button>
      </div>
    </div>
  </div>
</template>
