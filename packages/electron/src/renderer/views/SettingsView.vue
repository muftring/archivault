<script setup lang="ts">
import { reactive, watch } from 'vue';
import { DatabaseZap, RefreshCw, Save } from '@lucide/vue';
import { useConfig, useDbSetup, useSaveConfig } from '../composables/useArchivaultApi';
import { useToast } from '../composables/useToast';
import type { AppConfig } from '../lib/types';

const { show } = useToast();
const { data: config } = useConfig();
const saveConfig = useSaveConfig();
const dbSetup = useDbSetup();

const form = reactive<AppConfig>({
  bucket: '',
  region: '',
  profile: undefined,
  storageClass: '',
  endpoint: undefined,
  database: {
    type: 'sqlite',
    sqlite: { path: '' },
    postgres: { host: '', port: undefined, database: '', schema: '', username: '', password: '', ssl: false },
  },
});

watch(
  config,
  (value) => {
    if (!value) return;
    form.bucket = value.bucket ?? '';
    form.region = value.region ?? '';
    form.profile = value.profile;
    form.storageClass = value.storageClass ?? '';
    form.endpoint = value.endpoint;
    form.database = {
      type: value.database?.type ?? 'sqlite',
      sqlite: { path: value.database?.sqlite?.path ?? '' },
      postgres: {
        host: value.database?.postgres?.host ?? '',
        port: value.database?.postgres?.port,
        database: value.database?.postgres?.database ?? '',
        schema: value.database?.postgres?.schema ?? '',
        username: value.database?.postgres?.username ?? '',
        password: value.database?.postgres?.password ?? '',
        ssl: value.database?.postgres?.ssl ?? false,
      },
    };
  },
  { immediate: true }
);

function handleSave() {
  saveConfig.mutate(
    { ...form },
    {
      onSuccess: () => show('Configuration saved.', 'success'),
      onError: (err) => show(`Save failed: ${(err as Error).message}`, 'error'),
    }
  );
}

function handleDbSetup() {
  dbSetup.mutate(undefined, {
    onSuccess: (result) => show(`Database ready (${result.dbType}).`, 'success'),
    onError: (err) => show(`Database setup failed: ${(err as Error).message}`, 'error'),
  });
}
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <h1 class="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">Settings</h1>

    <div class="panel max-w-2xl space-y-6 p-5">
      <section>
        <h2 class="label mb-2">S3</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Bucket</label>
            <input class="input w-full" v-model="form.bucket" />
          </div>
          <div>
            <label class="label">Region</label>
            <input class="input w-full" v-model="form.region" />
          </div>
          <div>
            <label class="label">AWS profile</label>
            <input class="input w-full" v-model="form.profile" />
          </div>
          <div>
            <label class="label">Storage class</label>
            <input class="input w-full" v-model="form.storageClass" />
          </div>
          <div>
            <label class="label">Custom endpoint</label>
            <input class="input w-full" placeholder="e.g. LocalStack URL" v-model="form.endpoint" />
          </div>
        </div>
      </section>

      <section>
        <h2 class="label mb-2">Database</h2>
        <div>
          <label class="label">Backend</label>
          <select class="input w-full" v-model="form.database!.type">
            <option value="sqlite">SQLite (local file)</option>
            <option value="postgres">PostgreSQL (shared server)</option>
          </select>
        </div>

        <div v-if="form.database!.type === 'sqlite'" class="mt-3">
          <label class="label">SQLite path</label>
          <input class="input w-full" placeholder="~/.archivault/files.db" v-model="form.database!.sqlite!.path" />
        </div>

        <div v-else class="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label class="label">Host</label>
            <input class="input w-full" v-model="form.database!.postgres!.host" />
          </div>
          <div>
            <label class="label">Port</label>
            <input class="input w-full" type="number" v-model.number="form.database!.postgres!.port" />
          </div>
          <div>
            <label class="label">Database</label>
            <input class="input w-full" v-model="form.database!.postgres!.database" />
          </div>
          <div>
            <label class="label">Schema</label>
            <input class="input w-full" v-model="form.database!.postgres!.schema" />
          </div>
          <div>
            <label class="label">Username</label>
            <input class="input w-full" v-model="form.database!.postgres!.username" />
          </div>
          <div>
            <label class="label">Password</label>
            <input class="input w-full" type="password" v-model="form.database!.postgres!.password" />
          </div>
          <label class="col-span-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" v-model="form.database!.postgres!.ssl" />
            Enable SSL
          </label>
        </div>

        <button class="btn-secondary mt-3" :disabled="dbSetup.isPending.value" @click="handleDbSetup">
          <RefreshCw v-if="dbSetup.isPending.value" :size="14" class="animate-spin" />
          <DatabaseZap v-else :size="14" />
          Run DB Setup
        </button>
      </section>

      <button class="btn-primary" :disabled="saveConfig.isPending.value" @click="handleSave">
        <Save :size="14" /> Save Configuration
      </button>
    </div>
  </div>
</template>
