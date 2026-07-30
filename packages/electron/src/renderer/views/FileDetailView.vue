<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Archive, Download, RefreshCw, ShieldCheck, Trash2 } from '@lucide/vue';
import {
  useAddTag,
  useArchiveFile,
  useDeleteFile,
  useDownloadFile,
  useFile,
  useRemoveProperty,
  useRemoveTag,
  useSetProperty,
  useVerifyFile,
} from '../composables/useArchivaultApi';
import { useDownloadProgress } from '../composables/useProgress';
import { formatBytes, formatDateTime } from '../lib/format';
import StatusBadge from '../components/StatusBadge.vue';
import TagEditor from '../components/TagEditor.vue';
import PropertyEditor from '../components/PropertyEditor.vue';
import ProgressBar from '../components/ProgressBar.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import DetailField from '../components/DetailField.vue';
import { useToast } from '../composables/useToast';

const route = useRoute();
const router = useRouter();
const { show } = useToast();
const confirmAction = ref<'delete' | 'archive' | null>(null);

const fileId = computed(() => (route.params.fileId as string) ?? null);
const { data: file, isLoading: fileLoading } = useFile(fileId);

const addTag = useAddTag();
const removeTag = useRemoveTag();
const setProperty = useSetProperty();
const removeProperty = useRemoveProperty();
const verifyFile = useVerifyFile();
const deleteFile = useDeleteFile();
const archiveFile = useArchiveFile();
const downloadFile = useDownloadFile();
const downloadProgress = useDownloadProgress(computed(() => downloadFile.isPending.value));

async function handleDownload() {
  if (!file.value) return;
  const destDir = await window.archivault.dialog.openDirectory();
  if (!destDir) return;
  downloadFile.mutate(
    { fileId: file.value.id, destDir },
    {
      onSuccess: (result) => {
        const integrity =
          result.checksumMatch === true
            ? ' — integrity verified.'
            : result.checksumMatch === false
            ? ' — checksum mismatch!'
            : '';
        show(`Downloaded to ${result.destPath}${integrity}`, result.checksumMatch === false ? 'error' : 'success');
      },
      onError: (err) => show(`Download failed: ${(err as Error).message}`, 'error'),
    }
  );
}

function handleVerify() {
  if (!file.value) return;
  verifyFile.mutate(file.value.id, {
    onSuccess: (result) =>
      show(result.checksumMatch ? 'Checksum verified — OK.' : 'Checksum mismatch!', result.checksumMatch ? 'success' : 'error'),
    onError: (err) => show(`Verify failed: ${(err as Error).message}`, 'error'),
  });
}

function handleConfirmedAction() {
  if (!file.value) return;
  if (confirmAction.value === 'delete') {
    deleteFile.mutate(file.value.id, {
      onSuccess: () => {
        show('File marked as deleted.', 'success');
        router.push('/');
      },
    });
  } else if (confirmAction.value === 'archive') {
    archiveFile.mutate(file.value.id, { onSuccess: () => show('File archived.', 'success') });
  }
  confirmAction.value = null;
}

function handleAddTag(tag: string) {
  if (file.value) addTag.mutate({ fileId: file.value.id, tag });
}
function handleRemoveTag(tag: string) {
  if (file.value) removeTag.mutate({ fileId: file.value.id, tag });
}
function handleSetProperty(name: string, value: string) {
  if (file.value) setProperty.mutate({ fileId: file.value.id, name, value });
}
function handleRemoveProperty(name: string) {
  if (file.value) removeProperty.mutate({ fileId: file.value.id, name });
}
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <button class="btn-ghost mb-4" @click="router.push('/')">
      <ArrowLeft :size="14" /> Back
    </button>

    <p v-if="fileLoading" class="p-6 text-sm text-zinc-400">Loading…</p>

    <div v-else-if="!file" class="p-6">
      <p class="text-sm text-zinc-400">File not found.</p>
      <button class="btn-secondary mt-3" @click="router.push('/')">Back to files</button>
    </div>

    <div v-else class="panel p-5">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="break-all text-lg font-semibold text-zinc-800 dark:text-zinc-100">{{ file.fileName }}</h1>
          <div class="mt-1 flex items-center gap-2">
            <StatusBadge :status="file.status" />
            <span class="text-xs text-zinc-400">{{ file.id }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" :disabled="downloadFile.isPending.value" @click="handleDownload">
            <Download :size="14" /> Download
          </button>
          <button class="btn-secondary" :disabled="verifyFile.isPending.value" @click="handleVerify">
            <RefreshCw v-if="verifyFile.isPending.value" :size="14" class="animate-spin" />
            <ShieldCheck v-else :size="14" />
            Verify
          </button>
          <button class="btn-secondary" :disabled="file.status === 'archived'" @click="confirmAction = 'archive'">
            <Archive :size="14" /> Archive
          </button>
          <button class="btn-danger" @click="confirmAction = 'delete'">
            <Trash2 :size="14" /> Delete
          </button>
        </div>
      </div>

      <div v-if="downloadFile.isPending.value && downloadProgress" class="mt-4">
        <ProgressBar :loaded="downloadProgress.loaded" :total="downloadProgress.total" label="Downloading…" />
      </div>

      <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Source path">{{ file.sourcePath }}</DetailField>
        <DetailField label="MIME type">{{ file.mimeType ?? '—' }}</DetailField>
        <DetailField label="Size">{{ formatBytes(file.fileSize) }}</DetailField>
        <DetailField label="S3 bucket">{{ file.s3Bucket }}</DetailField>
        <DetailField label="S3 key">{{ file.s3Key }}</DetailField>
        <DetailField label="Storage class">{{ file.s3StorageClass ?? '—' }}</DetailField>
        <DetailField label="Uploaded at">{{ formatDateTime(file.uploadedAt) }}</DetailField>
        <DetailField label="Uploaded by">{{ file.uploadedBy ?? '—' }}</DetailField>
        <DetailField label="Last verified">
          {{ file.lastVerifiedAt ? formatDateTime(file.lastVerifiedAt) : 'Never' }}
        </DetailField>
        <DetailField label="Checksum (before)">{{ file.checksumBefore }}</DetailField>
        <DetailField label="Checksum (after)">{{ file.checksumAfter ?? '—' }}</DetailField>
      </div>

      <div class="mt-6">
        <h2 class="label">Tags</h2>
        <TagEditor
          :tags="file.tags"
          :disabled="addTag.isPending.value || removeTag.isPending.value"
          @add="handleAddTag"
          @remove="handleRemoveTag"
        />
      </div>

      <div class="mt-6">
        <h2 class="label">Properties</h2>
        <PropertyEditor
          :properties="file.properties"
          :disabled="setProperty.isPending.value || removeProperty.isPending.value"
          @set="handleSetProperty"
          @remove="handleRemoveProperty"
        />
      </div>
    </div>

    <ConfirmDialog
      :open="confirmAction !== null"
      :title="confirmAction === 'delete' ? 'Delete file?' : 'Archive file?'"
      :message="
        confirmAction === 'delete'
          ? 'This marks the file record as deleted. The underlying S3 object is not removed.'
          : 'This marks the file as archived. It will no longer appear in the default file list.'
      "
      :confirm-label="confirmAction === 'delete' ? 'Delete' : 'Archive'"
      :danger="confirmAction === 'delete'"
      @confirm="handleConfirmedAction"
      @cancel="confirmAction = null"
    />
  </div>
</template>
