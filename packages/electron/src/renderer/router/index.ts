import { createMemoryHistory, createRouter } from 'vue-router';
import FilesView from '../views/FilesView.vue';
import FileDetailView from '../views/FileDetailView.vue';
import BrowseView from '../views/BrowseView.vue';
import UploadView from '../views/UploadView.vue';
import SettingsView from '../views/SettingsView.vue';

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'files', component: FilesView },
    { path: '/files/:fileId', name: 'file-detail', component: FileDetailView },
    { path: '/browse', name: 'browse', component: BrowseView },
    { path: '/upload', name: 'upload', component: UploadView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});
