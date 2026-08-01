<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFolderChildren } from '../composables/useArchivaultApi';
import FolderTree from '../components/FolderTree.vue';
import Breadcrumb from '../components/Breadcrumb.vue';
import BrowseTable from '../components/BrowseTable.vue';

const route = useRoute();
const router = useRouter();

const currentPath = computed<string | null>(() => (route.query.path as string) || null);
const { data: listing, isLoading } = useFolderChildren(currentPath);

function navigateTo(path: string | null) {
  router.push({ path: '/browse', query: path ? { path } : {} });
}
</script>

<template>
  <div class="flex h-full">
    <aside class="w-64 shrink-0 overflow-auto border-r border-zinc-200 bg-panel dark:border-zinc-700 dark:bg-panel-dark">
      <FolderTree :current-path="currentPath" @navigate="navigateTo" />
    </aside>
    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="border-b border-zinc-200 bg-panel px-4 py-2 dark:border-zinc-700 dark:bg-panel-dark">
        <Breadcrumb :path="currentPath" @navigate="navigateTo" />
      </div>
      <BrowseTable
        :folders="listing?.folders ?? []"
        :files="listing?.files ?? []"
        :loading="isLoading"
        @enter-folder="navigateTo"
      />
    </div>
  </div>
</template>
