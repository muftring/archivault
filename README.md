# archivault

Upload and download files to/from AWS S3 with full metadata tracking, integrity verification, and search.

## Architecture

```
packages/
  core/       Shared library: S3 ops, SQLite database, checksums, file metadata
  cli/        Command-line interface (s3sync)
  electron/   Desktop GUI (Electron + React)
```

**Storage**: Files are stored in S3 under randomly generated `UUID/UUID` keys (no predictable patterns, good prefix distribution). Every upload is tracked in a local SQLite database with SHA256 checksums, tags, and arbitrary name-value properties.

**Database**: SQLite (`~/.s3sync/files.db`), optimized for 100M+ rows with WAL mode, a 64 MB page cache, and indexes on all query-heavy columns.

**Multipart**: Files ≥ 100 MB use S3 multipart upload (8 MB parts, 4 concurrent). Smaller files use single `PutObject`. Downloads stream directly from S3 with concurrent SHA256 verification.

## Authentication

The app uses the standard AWS credential chain — no credentials are stored in the app config or database.

**Recommended setup (IAM Identity Center / SSO):**
```bash
# Configure SSO once
aws configure sso

# Login before using s3sync
aws sso login --profile your-profile

# Tell s3sync which profile to use
s3sync config --profile your-profile
```

**Alternative (IAM user with access keys):**
```bash
aws configure --profile s3sync-user
s3sync config --profile s3sync-user
```

The app respects `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables.

## AWS Cost Estimate (10 TB / 100M files)

| Storage class | Monthly cost | Notes |
|---|---|---|
| S3 Standard | ~$236/mo | Good for frequently accessed files |
| **S3 Intelligent-Tiering** | **~$250/mo** | **Recommended** — auto-moves cold objects cheaper |
| S3 Glacier Instant | ~$41/mo | Archival; ms restore latency |
| S3 Glacier Deep Archive | ~$10/mo | Archival; 12h restore |

Additional costs:
- PUT requests (100M files, one-time): ~$500
- GET requests: $0.40 per million
- Egress: first 100 GB/month free, then $0.09/GB

## Installation

```bash
git clone <repo>
cd archivault
npm install
npm run build

# Install CLI globally
npm link --workspace=packages/cli
```

## Quick start

```bash
# 1. Configure
s3sync config --bucket my-photos-bucket --region us-east-1 --profile my-profile

# 2. Upload a directory
s3sync upload ~/Pictures --recursive --tag photos --tag 2024

# 3. List uploaded files
s3sync list --tag photos
s3sync list --name ".jpg" --from 2024-01-01
s3sync list --path /Users/michael/Pictures/vacation

# 4. Show details for a file
s3sync show <file-id>

# 5. Download a file
s3sync download <file-id> ~/Downloads

# 6. Verify integrity (re-downloads and checks SHA256)
s3sync verify --unverified --limit 500
```

## CLI Reference

### `s3sync upload <source>`

| Flag | Description |
|---|---|
| `-b, --bucket <name>` | S3 bucket (or use configured default) |
| `-r, --recursive` | Recurse into subdirectories |
| `-s, --storage-class` | Storage class (default: `INTELLIGENT_TIERING`) |
| `-t, --tag <tag>` | Add a tag (repeatable) |
| `-p, --property <k=v>` | Add a property (repeatable) |
| `--profile <name>` | AWS profile |
| `--dry-run` | Preview without uploading |

### `s3sync download <file-id> <dest-dir>`

Downloads the file and verifies SHA256 checksum. Use `--no-verify` to skip.

### `s3sync list`

| Flag | Description |
|---|---|
| `--path <prefix>` | Filter by source path prefix |
| `--name <pattern>` | Filter by filename (substring) |
| `--from / --to <date>` | Filter by upload date (ISO 8601) |
| `-t, --tag <tag>` | Filter by tag (repeatable; all must match) |
| `--prop <name>` | Filter by property name |
| `--prop-value <value>` | Filter by property value |
| `--sort <field>` | Sort by `uploaded_at`, `file_name`, or `file_size` |
| `--limit / --offset` | Pagination |
| `--json` | JSON output |

### `s3sync show <file-id>`

Shows full file record including checksums, S3 key, tags, and properties.

### `s3sync verify`

Re-downloads files from S3 and compares SHA256. Use `--unverified` to only check files never verified, `--limit` to control batch size.

### `s3sync tag add/remove <file-id> <tag>`

### `s3sync prop set/remove <file-id> <name> [value]`

### `s3sync config`

```bash
s3sync config --bucket my-bucket --region us-east-1
s3sync config --show
```

Config is stored at `~/.s3sync/config.json`. Database at `~/.s3sync/files.db`.

## Database Schema

```
files            — one row per uploaded file
  id             UUID primary key
  source_path    original local path
  file_name      basename
  file_extension
  mime_type      MIME type (by extension)
  file_size      bytes
  checksum_before  SHA256 before upload
  checksum_after   SHA256 after last verify
  s3_bucket
  s3_key         UUID/UUID
  s3_storage_class
  uploaded_at    ISO 8601
  last_verified_at
  status         active | deleted | archived

file_tags        — many-to-many tags
  file_id, tag

file_properties  — arbitrary name-value pairs per file
  file_id, name, value
```

Indexes on: `source_path`, `file_name`, `uploaded_at`, `checksum_before`, `s3_key`, `status`, tags, and property name/value.

## Electron App

```bash
npm run dev:electron
```

The Electron app exposes all core functionality through a secure IPC bridge (`contextBridge`). The main process calls into `@s3sync/core` directly; the renderer only sees the typed `window.s3sync` API defined in `preload.ts`.
