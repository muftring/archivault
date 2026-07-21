<script setup lang="ts">
import { computed, ref } from 'vue';
import { RefreshCw, ShieldCheck } from '@lucide/vue';
import { useFiles, useFilesCount, usePropertyNames, useTagsList, useVerifyBatch } from '../composables/useArchivaultApi';
import { useVerifyProgress } from '../composables/useProgress';
import { useToast } from '../composables/useToast';
import FileFilters from '../components/FileFilters.vue';
import FileTable from '../components/FileTable.vue';
import type { FileFilterState } from '../lib/types';

const PAGE_SIZE = 50;

const filters = ref<FileFilterState>({ status: 'active', orderBy: 'uploaded_at', orderDir: 'desc' });
const page = ref(0);
const { show } = useToast();

const listOpts = computed(() => ({ ...filters.value, limit: PAGE_SIZE, offset: page.value * PAGE_SIZE }));
const { data: files, isLoading: filesLoading } = useFiles(listOpts);
const { data: totalCount } = useFilesCount(filters);
const { data: availableTags } = useTagsList();
const { data: availablePropertyNames } = usePropertyNames();
const verifyBatch = useVerifyBatch();
const verifyProgress = useVerifyProgress(computed(() => verifyBatch.isPending.value));

function handleFiltersUpdate(next: FileFilterState) {
  filters.value = next;
  page.value = 0;
}

function handleVerifyUnverified() {
  verifyBatch.mutate(
    { unverified: true, limit: 200 },
    {
      onSuccess: (result) => {
        show(
          `Verified ${result.results.length} file(s): ${
            result.results.filter((r) => r.checksumMatch).length
          } OK, ${result.results.filter((r) => !r.checksumMatch).length} mismatch(es), ${result.errors.length} error(s).`,
          result.errors.length > 0 ? 'error' : 'success'
        );
      },
      onError: (err) => show(`Verify failed: ${(err as Error).message}`, 'error'),
    }
  );
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="flex items-center justify-between border-b border-zinc-200 bg-panel px-4 py-2 dark:border-zinc-700 dark:bg-panel-dark"
    >
      <h1 class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Files</h1>
      <button
        type="button"
        class="btn-secondary"
        :disabled="verifyBatch.isPending.value"
        @click="handleVerifyUnverified"
      >
        <RefreshCw v-if="verifyBatch.isPending.value" :size="14" class="animate-spin" />
        <ShieldCheck v-else :size="14" />
        {{
          verifyBatch.isPending.value && verifyProgress
            ? `Verifying ${verifyProgress.fileIndex + 1}/${verifyProgress.fileCount}…`
            : 'Verify Unverified'
        }}
      </button>
    </div>

    <FileFilters
      :filters="filters"
      :available-tags="availableTags ?? []"
      :available-property-names="availablePropertyNames ?? []"
      @update:filters="handleFiltersUpdate"
    />

    <FileTable
      :files="files ?? []"
      :loading="filesLoading"
      :page="page"
      :page-size="PAGE_SIZE"
      :total="totalCount ?? 0"
      @page-change="(p) => (page = p)"
    />
  </div>
</template>
