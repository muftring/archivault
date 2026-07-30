<script setup lang="ts">
import Sidebar from './components/Sidebar.vue';
import ToastHost from './components/ToastHost.vue';
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>
    <ToastHost />
  </div>
</template>
