# archivault

Upload and download files to/from AWS S3 with full metadata tracking, integrity verification, and search.

## Architecture

```
packages/
  core/       Shared library: S3 ops, database, checksums, file metadata
  cli/        Command-line interface (archivault)
  electron/   Desktop GUI (Electron + React)
```

**Storage**: Files are stored in S3 under randomly generated `UUID/UUID` keys (no predictable patterns, good prefix distribution). Every upload is tracked in a database with SHA256 checksums, tags, arbitrary name-value properties, and an optional uploader identity.

**Database**: Configurable — SQLite (default, local file) or PostgreSQL (shared server). SQLite is optimized for 100M+ rows with WAL mode, a 64 MB page cache, and indexes on all query-heavy columns.

**Multipart**: Files ≥ 100 MB use S3 multipart upload (8 MB parts, 4 concurrent). Smaller files use single `PutObject`. Downloads stream directly from S3 with concurrent SHA256 verification.

## Authentication

The app uses the standard AWS credential chain — no credentials are stored in the app config or database.

**Recommended setup (IAM Identity Center / SSO):**
```bash
# Configure SSO once
aws configure sso

# Login before using archivault
aws sso login --profile your-profile

# Tell archivault which profile to use
archivault config --profile your-profile
```

**Alternative (IAM user with access keys):**
```bash
aws configure --profile archivault-user
archivault config --profile archivault-user
```

The app respects `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables.

## AWS Cost Estimate

All figures are us-east-1 monthly storage costs. 1 TB = 1,024 GB.

| Storage class | 100 GB | 500 GB | 1 TB | 5 TB | 10 TB |
|---|---|---|---|---|---|
| S3 Standard | $2.30 | $11.50 | $23.55 | $117.76 | $235.52 |
| **S3 Intelligent-Tiering**† | **$1.25** | **$6.25** | **$12.80** | **$64.00** | **$128.00** |
| S3 Glacier Instant | $0.40 | $2.00 | $4.10 | $20.48 | $40.96 |
| S3 Glacier Deep Archive | $0.10 | $0.50 | $1.01 | $5.07 | $10.14 |

† **Intelligent-Tiering is recommended** for archival use. Costs shown reflect the Infrequent Access tier ($0.0125/GB), which is the steady state for data untouched for 30+ days. Newly uploaded files start at the Frequent Access rate ($0.023/GB, same as Standard) and drop automatically — no action required. A small per-object monitoring fee ($0.0025 per 1,000 objects) applies to objects ≥ 128 KB; at personal-archive scale this is negligible.

**Glacier** options require explicit retrieval requests and have minimum storage durations (90 days for Glacier Instant, 180 days for Deep Archive). Use them only if you rarely need to access files.

Additional costs:
- PUT requests: $0.005 per 1,000 uploads (one-time, at upload)
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

### SQLite (default — single machine)

```bash
# 1. Configure S3
archivault config --bucket my-photos-bucket --region us-east-1 --profile my-profile

# 2. Upload
archivault upload ~/Pictures --recursive --tag photos --tag 2024 --uploaded-by alice

# 3. List and search
archivault list --tag photos
archivault list --name ".jpg" --from 2024-01-01
archivault list --uploaded-by alice

# 4. Show details, download, verify
archivault show <file-id>
archivault download <file-id> ~/Downloads
archivault verify --unverified --limit 500
```

### PostgreSQL (shared / multi-user)

```bash
# 1. Point archivault at your Postgres instance
archivault config \
  --db-type postgres \
  --pg-host db.example.com \
  --pg-database archivault \
  --pg-username archivault_user \
  --pg-password secret \
  --pg-schema archivault

# 2. Create the schema (run once)
archivault db setup

# 3. Configure S3 and use normally
archivault config --bucket my-photos-bucket --region us-east-1
archivault upload ~/Pictures --recursive --uploaded-by alice
```

## CLI Reference

### `archivault upload <source>`

| Flag | Description |
|---|---|
| `-b, --bucket <name>` | S3 bucket (or use configured default) |
| `-r, --recursive` | Recurse into subdirectories |
| `-s, --storage-class` | Storage class (default: `INTELLIGENT_TIERING`) |
| `-u, --uploaded-by <user>` | Record who uploaded the file |
| `-t, --tag <tag>` | Add a tag (repeatable) |
| `-p, --property <k=v>` | Add a property (repeatable) |
| `--profile <name>` | AWS profile |
| `--dry-run` | Preview without uploading |

### `archivault download <file-id> <dest-dir>`

Downloads the file and verifies SHA256 checksum. Use `--no-verify` to skip.

### `archivault list`

| Flag | Description |
|---|---|
| `--path <prefix>` | Filter by source path prefix |
| `--name <pattern>` | Filter by filename (substring) |
| `--from / --to <date>` | Filter by upload date (ISO 8601) |
| `--uploaded-by <user>` | Filter by uploader |
| `-t, --tag <tag>` | Filter by tag (repeatable; all must match) |
| `--prop <name>` | Filter by property name |
| `--prop-value <value>` | Filter by property value |
| `--sort <field>` | Sort by `uploaded_at`, `file_name`, or `file_size` |
| `--limit / --offset` | Pagination |
| `--json` | JSON output |

### `archivault show <file-id>`

Shows full file record including checksums, S3 key, tags, properties, and uploader.

### `archivault verify`

Re-downloads files from S3 and compares SHA256. Use `--unverified` to only check files never verified, `--limit` to control batch size.

### `archivault tag add/remove <file-id> <tag>`

### `archivault prop set/remove <file-id> <name> [value]`

### `archivault config`

```bash
# S3
archivault config --bucket my-bucket --region us-east-1 --profile my-profile

# Switch to SQLite with a custom path
archivault config --db-type sqlite --sqlite-path /data/archivault.db

# Switch to PostgreSQL
archivault config --db-type postgres \
  --pg-host localhost --pg-port 5432 \
  --pg-database archivault --pg-schema public \
  --pg-username user --pg-password secret \
  --pg-ssl

# Show current config
archivault config --show
```

Config is stored at `~/.archivault/config.json`. The `ARCHIVAULT_CONFIG_DIR` environment variable overrides the config directory.

### `archivault db setup`

Creates the database schema. Required when first using PostgreSQL; a no-op for SQLite (tables are created automatically). Safe to re-run — all statements are idempotent.

## Database Schema

```
files              — one row per uploaded file
  id               UUID primary key
  source_path      original local path
  file_name        basename
  file_extension
  mime_type        MIME type (by extension)
  file_size        bytes
  checksum_before  SHA256 before upload
  checksum_after   SHA256 after last verify
  s3_bucket
  s3_key           UUID/UUID
  s3_storage_class
  uploaded_at      ISO 8601
  uploaded_by      optional uploader identifier
  last_verified_at
  status           active | deleted | archived

file_tags          — many-to-many tags
  file_id, tag

file_properties    — arbitrary name-value pairs per file
  file_id, name, value
```

Indexes on: `source_path`, `file_name`, `uploaded_at`, `uploaded_by`, `checksum_before`, `s3_key`, `status`, tags, and property name/value.

## Database Configuration

The active backend is selected by `database.type` in `~/.archivault/config.json`.

### SQLite (default)

```json
{
  "database": {
    "type": "sqlite",
    "sqlite": { "path": "~/.archivault/files.db" }
  }
}
```

Tables are created automatically on first run. No setup required.

### PostgreSQL

```json
{
  "database": {
    "type": "postgres",
    "postgres": {
      "host": "localhost",
      "port": 5432,
      "database": "archivault",
      "schema": "public",
      "username": "archivault_user",
      "password": "secret",
      "ssl": false
    }
  }
}
```

Run `archivault db setup` once after configuring to create the schema. Existing SQLite databases are automatically migrated when new columns are added.

## Infrastructure (Terraform)

The `infra/` directory provisions all required AWS resources.

### Prerequisites

- Terraform ≥ 1.9 (`brew install terraform`)
- AWS CLI configured with an account that has admin rights for the one-time bootstrap
- IAM Identity Center already enabled in your AWS organization

### Step 1 — Bootstrap (run once)

Creates the S3 state bucket and DynamoDB lock table used by all subsequent Terraform runs.

```bash
cd infra/bootstrap
terraform init
terraform apply
```

### Step 2 — Configure the backend

```bash
cd infra/main
cp backend.hcl.example backend.hcl
# Edit backend.hcl — paste the outputs from the bootstrap step
terraform init -backend-config=backend.hcl
```

### Step 3 — Configure variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set your SSO username, home IP, region, etc.
```

### Step 4 — Apply

```bash
terraform plan   # review what will be created
terraform apply
```

After apply, Terraform prints a `next_steps` output with the exact `archivault config` commands to run.

### What gets created

| Resource | Notes |
|---|---|
| `aws_s3_bucket` | Archive bucket, SSE-S3, public access blocked, versioning on |
| `aws_s3_bucket_lifecycle_configuration` | Aborts incomplete multipart uploads after 7 days; expires old versions after 90 days |
| `aws_ssoadmin_permission_set` | Least-privilege S3 policy (ListBucket, GetObject, PutObject, DeleteObject, HeadObject, multipart ops) |
| `aws_ssoadmin_account_assignment` | Assigns the permission set to your IAM Identity Center user |
| `aws_db_instance` | RDS PostgreSQL 16, `db.t4g.micro`, gp3, encrypted, 7-day backups |
| `aws_security_group` | Restricts port 5432 to `allowed_cidr_blocks` |

### Estimated monthly cost

| Resource | Cost |
|---|---|
| S3 storage (variable) | ~$0.023/GB |
| RDS `db.t4g.micro` | ~$15–18/mo |
| RDS storage (20 GB gp3) | ~$2.30/mo |
| DynamoDB lock table | < $0.01/mo |
| **Total (excluding S3 data)** | **~$18/mo** |

## Testing

```bash
npm test               # run all tests
npm test --workspace=packages/core   # core library only
```

Tests use Vitest with an in-memory SQLite database — no external services required. The `ARCHIVAULT_CONFIG_DIR` environment variable isolates config reads so tests never touch `~/.archivault`.

## Electron App

```bash
npm run dev:electron
```

The Electron app exposes all core functionality through a secure IPC bridge (`contextBridge`). The main process calls into `@archivault/core` directly; the renderer only sees the typed `window.archivault` API defined in `preload.ts`.
