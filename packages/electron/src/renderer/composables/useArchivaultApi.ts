import { computed, type Ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { AppConfig, ListFilesOptions } from '../lib/types';

function invalidateFileLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['files'] });
  queryClient.invalidateQueries({ queryKey: ['filesCount'] });
}

export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: () => window.archivault.config.load() });
}

export function useSaveConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<AppConfig>) => window.archivault.config.save(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config'] }),
  });
}

export function useFiles(opts: Ref<ListFilesOptions>) {
  return useQuery({
    queryKey: computed(() => ['files', opts.value]),
    queryFn: () => window.archivault.files.list(opts.value),
  });
}

export function useFilesCount(opts: Ref<Omit<ListFilesOptions, 'limit' | 'offset' | 'orderBy' | 'orderDir'>>) {
  return useQuery({
    queryKey: computed(() => ['filesCount', opts.value]),
    queryFn: () => window.archivault.files.count(opts.value),
  });
}

export function useFile(id: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => ['file', id.value]),
    queryFn: () => window.archivault.files.get(id.value as string),
    enabled: computed(() => id.value !== null),
  });
}

export function useTagsList() {
  return useQuery({ queryKey: ['tags'], queryFn: () => window.archivault.tags.list() });
}

export function usePropertyNames() {
  return useQuery({ queryKey: ['propNames'], queryFn: () => window.archivault.props.listNames() });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => window.archivault.files.delete(id),
    onSuccess: (_data, id) => {
      invalidateFileLists(queryClient);
      queryClient.invalidateQueries({ queryKey: ['file', id] });
    },
  });
}

export function useArchiveFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => window.archivault.files.archive(id),
    onSuccess: (_data, id) => {
      invalidateFileLists(queryClient);
      queryClient.invalidateQueries({ queryKey: ['file', id] });
    },
  });
}

export function useAddTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, tag }: { fileId: string; tag: string }) => window.archivault.tags.add(fileId, tag),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      invalidateFileLists(queryClient);
    },
  });
}

export function useRemoveTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, tag }: { fileId: string; tag: string }) => window.archivault.tags.remove(fileId, tag),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      invalidateFileLists(queryClient);
    },
  });
}

export function useSetProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, name, value }: { fileId: string; name: string; value: string }) =>
      window.archivault.props.set(fileId, name, value),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['propNames'] });
      invalidateFileLists(queryClient);
    },
  });
}

export function useRemoveProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, name }: { fileId: string; name: string }) => window.archivault.props.remove(fileId, name),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['propNames'] });
      invalidateFileLists(queryClient);
    },
  });
}

export function useVerifyFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => window.archivault.files.verify(fileId),
    onSuccess: (_data, fileId) => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      invalidateFileLists(queryClient);
    },
  });
}

export function useVerifyBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts: { unverified?: boolean; limit?: number }) => window.archivault.files.verifyBatch(opts),
    onSuccess: () => invalidateFileLists(queryClient),
  });
}

export function useUploadBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opts: Parameters<typeof window.archivault.files.uploadBatch>[0]) =>
      window.archivault.files.uploadBatch(opts),
    onSuccess: (result) => {
      if (!result.dryRun) {
        invalidateFileLists(queryClient);
        queryClient.invalidateQueries({ queryKey: ['tags'] });
        queryClient.invalidateQueries({ queryKey: ['propNames'] });
      }
    },
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: ({ fileId, destDir }: { fileId: string; destDir: string }) =>
      window.archivault.files.download(fileId, destDir),
  });
}

export function useDbSetup() {
  return useMutation({
    mutationFn: () => window.archivault.db.setup(),
  });
}
