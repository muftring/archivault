<script setup lang="ts">
import type { FileFilterState, ListFilesOptions } from '../lib/types';

const props = defineProps<{
  filters: FileFilterState;
  availableTags: string[];
  availablePropertyNames: string[];
}>();
const emit = defineEmits<{ 'update:filters': [FileFilterState] }>();

const STATUS_OPTIONS = ['active', 'archived', 'deleted'];
const SORT_OPTIONS: Array<{ value: NonNullable<ListFilesOptions['orderBy']>; label: string }> = [
  { value: 'uploaded_at', label: 'Upload date' },
  { value: 'file_name', label: 'File name' },
  { value: 'file_size', label: 'File size' },
];

function set(patch: Partial<FileFilterState>) {
  emit('update:filters', { ...props.filters, ...patch });
}

function onInput(key: keyof FileFilterState, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  set({ [key]: value || undefined } as Partial<FileFilterState>);
}

function onDateInput(key: 'fromDate' | 'toDate', event: Event) {
  const value = (event.target as HTMLInputElement).value;
  const suffix = key === 'fromDate' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  set({ [key]: value ? `${value}${suffix}` : undefined });
}

function reset() {
  emit('update:filters', { status: 'active', orderBy: 'uploaded_at', orderDir: 'desc' });
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-panel p-3 dark:border-zinc-700 dark:bg-panel-dark"
  >
    <div>
      <label class="label">Name</label>
      <input
        class="input w-40"
        placeholder="Search filename…"
        :value="filters.fileName ?? ''"
        @input="onInput('fileName', $event)"
      />
    </div>

    <div>
      <label class="label">Path prefix</label>
      <input
        class="input w-40"
        placeholder="/photos"
        :value="filters.pathPrefix ?? ''"
        @input="onInput('pathPrefix', $event)"
      />
    </div>

    <div>
      <label class="label">Uploaded by</label>
      <input class="input w-32" :value="filters.uploadedBy ?? ''" @input="onInput('uploadedBy', $event)" />
    </div>

    <div>
      <label class="label">From</label>
      <input
        type="date"
        class="input w-36"
        :value="filters.fromDate?.slice(0, 10) ?? ''"
        @input="onDateInput('fromDate', $event)"
      />
    </div>

    <div>
      <label class="label">To</label>
      <input
        type="date"
        class="input w-36"
        :value="filters.toDate?.slice(0, 10) ?? ''"
        @input="onDateInput('toDate', $event)"
      />
    </div>

    <div>
      <label class="label">Tag</label>
      <select
        class="input w-32"
        :value="filters.tags?.[0] ?? ''"
        @change="set({ tags: ($event.target as HTMLSelectElement).value ? [($event.target as HTMLSelectElement).value] : undefined })"
      >
        <option value="">Any</option>
        <option v-for="tag in availableTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </div>

    <div>
      <label class="label">Property</label>
      <select
        class="input w-32"
        :value="filters.propertyName ?? ''"
        @change="set({ propertyName: ($event.target as HTMLSelectElement).value || undefined, propertyValue: undefined })"
      >
        <option value="">Any</option>
        <option v-for="name in availablePropertyNames" :key="name" :value="name">{{ name }}</option>
      </select>
    </div>

    <div v-if="filters.propertyName">
      <label class="label">Value</label>
      <input class="input w-28" :value="filters.propertyValue ?? ''" @input="onInput('propertyValue', $event)" />
    </div>

    <div>
      <label class="label">Status</label>
      <select
        class="input w-28"
        :value="filters.status ?? 'active'"
        @change="set({ status: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div>
      <label class="label">Sort</label>
      <div class="flex gap-1">
        <select
          class="input"
          :value="filters.orderBy ?? 'uploaded_at'"
          @change="set({ orderBy: ($event.target as HTMLSelectElement).value as ListFilesOptions['orderBy'] })"
        >
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select
          class="input"
          :value="filters.orderDir ?? 'desc'"
          @change="set({ orderDir: ($event.target as HTMLSelectElement).value as ListFilesOptions['orderDir'] })"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>
    </div>

    <button type="button" class="btn-ghost ml-auto" @click="reset">Reset</button>
  </div>
</template>
