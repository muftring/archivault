# Archivault: Design Notes

Working notes on the Electron UI rebuild and release pipeline added in the
`electron-ui-release-pipeline` branch. Captures why things were built the way
they were, what's known to still be missing, and what a release actually
involves going forward.

## Context

Archivault's CLI was solid but the Electron desktop app was a first draft:
one 250-line `App.tsx`, inline styles, no router, and real functional gaps
against the CLI (no verify, no tag/property editing, no delete/archive, no
file detail view, no DB config in Settings). The product also still displayed
"S3 Sync" from before the project's rename, and nothing had ever been
released — no CI, no versioning scheme, the CLI never published, and
`electron-builder` installed but unconfigured.

This work rebuilds the Electron app as a feature-complete, visually coherent
desktop app and stands up a tag-triggered release pipeline that publishes the
CLI to npm and the Electron app to GitHub Releases for mac/win/linux.

## Architecture decisions

### Frontend framework: Vue, not React

The UI was first built in React, then rebuilt in Vue 3 at the maintainer's
request — they know Vue, not React, and will be the one maintaining this
code. The React version was never committed; there's no migration history to
reconcile, just one Vue implementation.

Stack:
- **Vue 3** with `<script setup lang="ts">` throughout (Composition API).
- **vue-router 4**, using `createMemoryHistory()` rather than browser
  history — there's no real URL bar in a packaged Electron renderer.
- **@tanstack/vue-query** as the data layer over the `window.archivault` IPC
  bridge. This replaces ad hoc `useState`/`useEffect`-equivalent fetch code
  and — importantly — gives automatic refetch-after-mutation for
  delete/archive/tag/verify actions, which the original app didn't do
  consistently.
- **Tailwind CSS v3** (not v4). v4's `@tailwindcss/oxide` native engine and
  `@vitejs/plugin-vue@6`/`vue-router@5` all require Node ≥20; the dev
  machine runs Node 18.17.1. Pinned to the last majors that support Node 18
  (`tailwindcss@3.4.x`, `@vitejs/plugin-vue@5.2.x`, `vue-router@4.6.x`)
  rather than forcing a Node upgrade as a side effect of a UI rewrite.
- **@lucide/vue** for icons (`lucide-vue-next` is deprecated in favor of it).

Renderer layout: `components/` (presentational), `views/` (routed pages),
`composables/` (the query/mutation API layer + IPC event subscriptions),
`lib/` (shared types + formatting), `router/`, `styles/`.

### Core package: shared logic, not duplicated logic

Before this work, the CLI's `verify` command inlined its own
download-and-compare loop, and `upload` had its own private recursive
directory walker — neither was reusable by the Electron app. Both were
extracted into `@archivault/core`:

- `verifyFile()` (`packages/core/src/s3/verify.ts`) — re-download, compare
  checksum, update `checksumAfter`, clean up. Used by both the CLI's
  `verify` command and Electron's single/batch verify IPC handlers.
- `collectUploadPaths()` (`packages/core/src/utils/walk.ts`) — the recursive
  file walk, now shared by the CLI's `upload` command and Electron's
  `files:uploadBatch` handler.
- `countFiles()`, `listDistinctTags()`, `listDistinctPropertyNames()` — new,
  needed for the Electron UI's real pagination (total count, not just a
  page) and filter dropdowns (which tags/properties actually exist), which
  didn't exist in any form before.

### IPC surface

`main.ts`/`preload.ts` gained: `files:count`, `files:uploadBatch` (replacing
the old single-file `files:upload`), `files:verify`, `files:verifyBatch`,
`tags:list`, `props:listNames`, `db:setup`, plus a `verify:progress` event
and a renamed `uploadBatch:progress` (carries per-file index/count, not just
byte progress for one file).

## Feature additions (Electron ↔ CLI parity)

| Gap in the old UI | What was added |
|---|---|
| No file detail view | Full record view: checksums, S3 key/storage class, uploader, `lastVerifiedAt`, status |
| No tag/property editing | Inline chip/key-value editors in the detail view |
| No delete/archive | Row + detail actions, behind a confirm dialog (status-changing, hard to reverse) |
| No verify | Single-file verify button + "Verify Unverified" bulk action, built on `verifyFile()` |
| Search-only filtering | Path prefix, date range, uploader, tag, property name/value, status, sort — all wired to real core query params |
| No real pagination | Total count via `countFiles()`, not just a page of results |
| **Broken folder upload** | The old UI passed a directory straight to a function that expects one file path — uploading a folder likely never worked. Replaced with a proper walk-then-upload-per-file flow with live progress |
| No DB backend settings | SQLite path / full Postgres connection fields + "Run DB Setup", mirroring the CLI's `config`/`db setup` commands |
| Upload progress plumbing unused | IPC events were wired end-to-end but the old renderer never subscribed. Now rendered as a live progress bar |

## Bugs found and fixed (pre-existing, not introduced here)

Two real bugs surfaced only once the app was actually run and looked at —
both existed before this work and would have affected the React prototype
identically:

1. **Dev/prod loading path was broken.** `main.ts` branched on
   `process.env.NODE_ENV === 'development'`, but nothing in the `dev` script
   ever set that variable. Every `npm run dev:electron` silently fell
   through to the `else` branch and tried to load the *raw, unbuilt* source
   `index.html` via `file://` — which a browser can't execute (`.vue`/`.ts`
   imports need Vite). Result: a blank window, always. Fixed by switching to
   Electron's `app.isPackaged`, which needs no env var.
2. **The production path was also wrong** — it pointed at
   `src/renderer/index.html` (source) instead of the actual Vite build
   output at `dist/renderer/index.html`. A packaged build would have shipped
   a blank app.

Both were only caught because the maintainer granted screen-recording
permission and a real screenshot showed a blank window instead of the app.

## Release pipeline design

### Versioning

One shared version number across `core`/`cli`/`electron` (plus root),
bumped manually:

```bash
npm version 1.1.0 --workspaces --no-git-tag-version --include-workspace-root
git commit -am "Release v1.1.0" && git tag v1.1.0 && git push --follow-tags
```

No changesets/lerna — `core` is never independently published (see below),
and cli/electron ship as one product release for a solo-maintainer project.
The pushed tag is authoritative; CI cross-checks it against every
`package.json` and fails loudly on mismatch.

### CLI: bundled, not workspace-linked

`packages/cli` now builds via **esbuild** (`--bundle --platform=node
--external:better-sqlite3 --external:pg`) instead of plain `tsc`. This
inlines `@archivault/core`'s compiled code directly into the published
package — core stays `"private"` (implicit, no `publishConfig`) and is
**never published to npm** on its own; it has exactly one real consumer's
worth of design, not library shape. `better-sqlite3`/`pg` stay external and
are real `dependencies` of the CLI now, since bundling a native addon would
bake in one platform's prebuilt binary and break every other platform. A
`files` field restricts the published tarball to the built bundle — the
first pack attempt accidentally included stale per-file `tsc` output and the
entire `src/` tree; `npm pack --dry-run` caught it.

### Electron packaging

`electron-builder` config gained `asarUnpack` for `better-sqlite3` (Node
can't `dlopen` a native `.node` file from inside an asar archive — without
this the packaged app crashes on first DB operation, even though the build
itself succeeds), icon paths for all three platforms, and a GitHub `publish`
block.

Two workspace-hoisting quirks discovered by actually running the tools, not
by reading docs:
- `electron-builder install-app-deps` (the "official" way to rebuild native
  modules for Electron's ABI) can't find the hoisted `electron` package in
  this npm-workspaces layout and does nothing silently. Replaced with
  `packages/electron/scripts/rebuild-native.js`, which resolves
  `electron/package.json` and `better-sqlite3/package.json` via normal
  Node module resolution (which does walk up to the hoisted root) and calls
  `prebuild-install --runtime=electron --target=<version>` directly.
- `electron-builder` itself can't auto-detect the installed Electron version
  in this layout either (same root cause) and fails packaging outright. Fixed
  by pinning `"electronVersion"` explicitly in the `build` config — this is
  a known, documented workaround for exactly this issue, but it means
  **`electronVersion` must be bumped by hand whenever the `electron`
  devDependency is upgraded**, or packaging will silently target a stale
  Electron runtime.

### CI (`.github/workflows/release.yml`)

Triggered on `v*` tags. Four jobs:
1. `verify` — version-consistency check, builds core, runs its test suite,
   then creates the GitHub Release as a **draft** (avoids a race between the
   three parallel electron-builder matrix legs each trying to create the
   same release).
2. `build-electron` — matrix across macos-latest/windows-latest/ubuntu-latest,
   rebuilds the native module per-OS, packages, and uploads installers to
   the draft release via electron-builder's built-in GitHub publish provider.
3. `publish-npm` — bundles and publishes `@archivault/cli`, runs in parallel
   with `build-electron`.
4. `finalize-release` — only un-drafts the release if *both* prior jobs
   succeeded, so a partial/broken release never goes public.

The workflow's config was validated as far as a sandboxed, no-network-access
environment allows (version/platform/arch resolution, icon config, asar
unpacking) but **has never actually run on GitHub Actions** — see the
release plan below.

## Branding

Generated a placeholder icon (flat vault/keyhole mark, purple) with a
small dependency-free Node script (`scripts/generate-icon.js`, raw PNG
encoding via `zlib.deflateSync`, no image library needed) at 1024×1024, then
derived the icns/ico/multi-size-png set via `electron-icon-builder`.
Renamed the product from "S3 Sync" (a rename-era leftover) to "Archivault"
everywhere: `productName`, window title, sidebar logo.

## Known limitations / accepted tradeoffs

- **Unsigned builds.** No Apple Developer Program enrollment or Windows
  code-signing cert — mac builds trigger Gatekeeper "damaged/unidentified
  developer," Windows nsis triggers SmartScreen. Users click through once.
- **Apple Silicon only for mac, for now.** GitHub's `macos-latest` runners
  are arm64; an Intel build needs explicit `"arch": ["x64","arm64"]` and a
  working universal `better-sqlite3` rebuild, not yet set up.
- **No automated tests for `cli` or `electron`.** Only `packages/core` has a
  test suite (63 tests, Vitest). CI can't catch regressions in the CLI's
  command wiring or the Electron UI beyond "it still compiles."
- **`better-sqlite3`'s ABI is a single-machine juggling act.** Rebuilding it
  for Electron (`npm run rebuild --workspace=packages/electron`) breaks
  `core`'s tests and the CLI until you `npm rebuild better-sqlite3` back to
  the host Node ABI. Not a bug, just a real workflow cost of one native
  dependency serving both a Node CLI and an Electron app from the same
  hoisted `node_modules`.
- **`package-lock.json`'s history isn't split by commit.** It's a single
  derived artifact; splitting its diff to match the four feature commits
  wasn't worth the fragility. It rides along with the release-pipeline
  commit at its final state.

## Proposed release plan

Not ready to tag a real release yet. In order:

1. **Merge the `electron-ui-release-pipeline` PR to `master`.** Tags should
   come from `master`, not a feature branch mid-review.
2. **One-time manual setup** (needs your npmjs.com account, not something
   that can be scripted from here):
   - Claim/create the `archivault` npm org or scope.
   - Generate an npm "Automation" token, add it as the `NPM_TOKEN` secret in
     the GitHub repo settings. (`GH_TOKEN` needs no setup — GitHub injects
     it automatically.)
3. **First tag should be a confidence check, not the real thing.** Push a
   tag and watch the Actions run before trusting it for a version that
   matters: confirm the three electron-builder matrix legs all produce
   installers, confirm `npm publish` succeeds and `npx @archivault/cli`
   actually installs and runs post-publish.
4. **After that works once**, releases are just: bump version across
   workspaces, commit, tag, push — CI does the rest.

## Future add-ons and capabilities

Roughly in order of "probably next" to "someday, maybe":

- **Code signing + notarization** (mac) and a signing cert (Windows) — the
  single biggest thing standing between this and a friction-free install
  for a non-technical user.
- **Auto-update** via `electron-updater`, which pairs naturally with the
  GitHub Releases publish target already in place.
- **Universal mac binaries** (arm64 + x64) once signing is sorted (no point
  fighting the native-module double-rebuild for an unsigned build nobody's
  Intel Mac will trust anyway).
- **Test coverage for `cli` and `electron`** — at minimum, a smoke test that
  boots the Electron app headlessly and exercises the IPC surface; CLI
  command tests mirroring the pattern already established in `core`.
- **Bulk row actions in the Files table** (multi-select delete/archive/tag)
  — the plumbing (`updateFileStatus`, `addTag`, etc.) already supports it
  per-file; the UI doesn't expose multi-select yet.
- **Native OS notifications** on long-running upload/verify batch
  completion, so the app doesn't need to stay focused to know when a big
  batch finishes.
- **Drag-and-drop upload** onto the Electron window, instead of only the
  folder-picker dialog.
- **Saved filter presets** — the filter set is rich now (path, date range,
  tag, property, uploader, status, sort) but has no way to save/recall a
  combination.
- **Multi-bucket support** — switch between several configured S3 buckets
  from Settings, rather than one default bucket per config file.
- **Changesets (or similar)**, if this project ever grows past a single
  maintainer — the "one shared version, bump by hand" scheme here is
  intentionally the simplest thing that works for one person, not a
  long-term bet.
