<script setup lang="ts">
import { computed, ref } from 'vue';
import { FolderOpen, RefreshCw, UploadCloud } from '@lucide/vue';
import { useConfig, useUploadBatch } from '../composables/useArchivaultApi';
import { useUploadProgress } from '../composables/useProgress';
import { useToast } from '../composables/useToast';
import ProgressBar from '../components/ProgressBar.vue';
import { formatBytes } from '../lib/format';
import type { UploadBatchPreviewItem } from '../lib/types';

const STORAGE_CLASSES = ['INTELLIGENT_TIERING', 'STANDARD', 'STANDARD_IA', 'GLACIER_IR', 'DEEP_ARCHIVE'];

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseProperties(input: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const line of input.split('\n')) {
    const [name, ...rest] = line.split('=');
    const key = name?.trim();
    if (key) props[key] = rest.join('=').trim();
  }
  return props;
}

const { show } = useToast();
const { data: config } = useConfig();
const uploadBatch = useUploadBatch();
const progress = useUploadProgress(computed(() => uploadBatch.isPending.value));

const sourcePath = ref<string | null>(null);
const recursive = ref(true);
const storageClass = ref('INTELLIGENT_TIERING');
const uploadedBy = ref('');
const tagsInput = ref('');
const propertiesInput = ref('');
const preview = ref<UploadBatchPreviewItem[] | null>(null);

async function pickSource() {
  const dir = await window.archivault.dialog.openDirectory();
  if (dir) {
    sourcePath.value = dir;
    preview.value = null;
  }
}

function buildOptions(dryRun: boolean) {
  return {
    bucket: config.value?.bucket ?? '',
    sourcePath: sourcePath.value as string,
    recursive: recursive.value,
    storageClass: storageClass.value,
    uploadedBy: uploadedBy.value.trim() || undefined,
    tags: parseTags(tagsInput.value),
    properties: parseProperties(propertiesInput.value),
    dryRun,
  };
}

function handleDryRun() {
  if (!sourcePath.value) return;
  uploadBatch.mutate(buildOptions(true), {
    onSuccess: (result) => (preview.value = result.preview ?? []),
    onError: (err) => show(`Preview failed: ${(err as Error).message}`, 'error'),
  });
}

function handleUpload() {
  if (!sourcePath.value) return;
  if (!config.value?.bucket) {
    show('Set a default S3 bucket in Settings first.', 'error');
    return;
  }
  uploadBatch.mutate(buildOptions(false), {
    onSuccess: (result) => {
      show(
        `Uploaded ${result.uploaded} file(s) (${formatBytes(result.totalBytes)}), ${result.failed} failed.`,
        result.failed > 0 ? 'error' : 'success'
      );
      preview.value = null;
      sourcePath.value = null;
    },
    onError: (err) => show(`Upload failed: ${(err as Error).message}`, 'error'),
  });
}
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <h1 class="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Upload</h1>

    <div class="panel max-w-2xl space-y-4 p-5">
      <div>
        <label class="label">Source</label>
        <div class="flex gap-2">
          <input class="input flex-1" readonly :value="sourcePath ?? ''" placeholder="Choose a folder…" />
          <button class="btn-secondary" @click="pickSource">
            <FolderOpen :size="14" /> Browse
          </button>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input type="checkbox" v-model="recursive" />
        Recurse into subdirectories
      </label>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Storage class</label>
          <select class="input w-full" v-model="storageClass">
            <option v-for="c in STORAGE_CLASSES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <label class="label">Uploaded by</label>
          <input class="input w-full" v-model="uploadedBy" />
        </div>
      </div>

      <div>
        <label class="label">Tags (comma-separated)</label>
        <input class="input w-full" v-model="tagsInput" />
      </div>

      <div>
        <label class="label">Properties (one name=value per line)</label>
        <textarea class="input w-full" rows="3" v-model="propertiesInput" />
      </div>

      <div class="flex gap-2">
        <button class="btn-secondary" :disabled="!sourcePath || uploadBatch.isPending.value" @click="handleDryRun">
          Preview
        </button>
        <button class="btn-primary" :disabled="!sourcePath || uploadBatch.isPending.value" @click="handleUpload">
          <RefreshCw v-if="uploadBatch.isPending.value" :size="14" class="animate-spin" />
          <UploadCloud v-else :size="14" />
          Upload
        </button>
      </div>

      <ProgressBar
        v-if="uploadBatch.isPending.value && progress"
        :loaded="progress.loaded"
        :total="progress.total"
        :label="`(${progress.fileIndex + 1}/${progress.fileCount}) ${progress.fileName}`"
      />

      <div v-if="preview">
        <h3 class="label">Preview ({{ preview.length }} file(s))</h3>
        <ul class="max-h-48 overflow-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
          <li v-for="item in preview" :key="item.filePath" class="flex justify-between px-1 py-0.5">
            <span class="truncate">{{ item.filePath }}</span>
            <span class="ml-2 shrink-0 text-zinc-400">{{ formatBytes(item.fileSize) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
