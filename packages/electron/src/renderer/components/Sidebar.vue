<script setup lang="ts">
import { Archive, FolderTree, Settings, UploadCloud } from '@lucide/vue';

const navItems = [
  { to: '/', label: 'Files', icon: Archive },
  { to: '/browse', label: 'Browse', icon: FolderTree },
  { to: '/upload', label: 'Upload', icon: UploadCloud },
  { to: '/settings', label: 'Settings', icon: Settings },
];
</script>

<template>
  <aside class="flex w-48 flex-col bg-surface-dark py-4">
    <div class="mb-4 px-4 text-base font-bold text-zinc-100">Archivault</div>
    <nav class="flex flex-col gap-0.5 px-2">
      <router-link v-for="item in navItems" :key="item.to" v-slot="{ isActive, navigate, href }" :to="item.to" custom>
        <a
          :href="href"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
          :class="isActive ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'"
          @click="navigate"
        >
          <component :is="item.icon" :size="16" />
          {{ item.label }}
        </a>
      </router-link>
    </nav>
  </aside>
</template>
