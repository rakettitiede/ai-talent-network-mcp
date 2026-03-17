# Database Setup Guide

> **Shell Compatibility:** Commands use bash syntax (`${VAR}`). For fish shell, use `$VAR` without braces.

This guide provides step-by-step instructions for setting up the SQLite database with vector extension support from scratch. This is particularly useful for partners and new team members who need to initialize the database locally or configure production deployments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Database Initialization](#database-initialization)
- [Vector Extension Setup](#vector-extension-setup)
- [GCS Bucket Setup](#gcs-bucket-setup)
- [Environment Variables](#environment-variables)
- [Verification Steps](#verification-steps)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Node.js

This project requires **Node.js v24.12.0** (LTS). The version is strictly enforced.

```bash
# Check your current version
node --version

# Install using nvm (recommended)
nvm install 24.12.0
nvm use 24.12.0

# Or use the project's .nvmrc file
nvm use
```

### SQLite3

SQLite3 is used as the underlying database. On most systems it's pre-installed, but verify:

```bash
# Check SQLite version (should be 3.x)
sqlite3 --version
```

**Installation if missing:**

```bash
# Ubuntu/Debian
sudo apt-get install sqlite3

# macOS (via Homebrew)
brew install sqlite3

# Windows (via Chocolatey)
choco install sqlite
```

### sqlite-vec Extension

The `sqlite-vec` extension enables vector similarity search. It's installed automatically as an npm dependency:

```bash
# Install project dependencies (includes sqlite-vec)
npm install
```

The `sqlite-vec` package (version `^0.1.7-alpha.2`) is a Node.js binding that loads automatically when the database is opened.

### Google Cloud CLI (for production)

Required only for production deployments to upload/download the database from GCS.

```bash
# Install gcloud CLI
# See: https://cloud.google.com/sdk/docs/install

# Verify installation
gcloud --version

# Authenticate
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

---

## Database Initialization

### Understanding the Database Flow

1. **Development mode**: Database is created locally as `development-db.sqlite`
2. **Production mode**: Database is downloaded from GCS on startup, stored in `/tmp/talent-network.sqlite`
3. **Refresh operation**: Fetches data from Agileday API, generates embeddings, and stores in database

### Step 1: Install Dependencies

```bash
cd /path/to/talent-network
npm install
```

This installs all required packages including:
- `better-sqlite3` - SQLite database driver
- `sqlite-vec` - Vector similarity search extension
- `@google-cloud/storage` - GCS client (for production)
- `openai` - For generating embeddings

### Step 2: Set Environment Variables

Create a `.env` file or export variables directly:

```bash
# Required for all operations
export API_KEY="your-secure-api-key"           # Generate with: openssl rand -hex 32
export AGILEDAY_BASE_URL="https://your-agileday-instance.com"
export OPENAI_KEY="your-openai-api-key"

# For development (database stored locally)
export NODE_ENV="development"

# For production (database stored in GCS)
export NODE_ENV="production"
export GCS_BUCKET="your-gcs-bucket-name"
```

### Step 3: Initialize the Database via Refresh

The database is created and populated through the `/api/v1/refresh` endpoint. Start the server and call refresh:

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Call the refresh endpoint
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"token": "your-agileday-hr-token"}' \
  "http://localhost:8080/api/v1/refresh"
```

**Important**: Use an Agileday API token with HR role to include recruits in the data.

### Expected Output

When refresh runs successfully, you'll see:

```
🚚 Initializing database...
🧩 Generating employee description embeddings... 45
✅ Employee descriptions embedded successfully!
🧩 Generating project description embeddings... 128
✅ Project descriptions embedded successfully!

👥 Total consultant-opening records (after flatMap): 52
👷 45 employees and his skills inserted into the database!
💼 128 projects in total!
🎯 52 openings in total!
🧱 Local mode — skipping GCS upload
✨ Database initialized successfully!
```

In production mode, you'll also see:
```
☁️ Uploading database to GCS bucket: your-bucket-name
✅ Database uploaded to GCS
📦 Synced updated database to GCS
```

### Database Schema Created

The refresh operation creates these tables:

| Table | Purpose |
|-------|---------|
| `employees` | Core employee data (id, name, description, segment) |
| `employee_skills` | Skills with proficiency and motivation scores |
| `employee_certificates` | Professional certifications |
| `project_history` | Historical projects with descriptions |
| `openings` | Current project assignments |
| `vec_employees` | Vector embeddings for employee descriptions |
| `vec_projects` | Vector embeddings for project descriptions |
| `employee_availability` (view) | Computed availability status |

---

## Vector Extension Setup

The `sqlite-vec` extension is crucial for semantic search functionality. It enables storing and querying 1536-dimensional vector embeddings from OpenAI's `text-embedding-3-small` model.

### How It Works

1. **Automatic loading**: The extension loads when the database connection opens:
   ```javascript
   import Database from 'better-sqlite3';
   import * as vec from 'sqlite-vec';
   
   const db = new Database('database.sqlite');
   vec.load(db);  // Loads the sqlite-vec extension
   ```

2. **Virtual tables**: Vector tables use the `vec0` virtual table module:
   ```sql
   CREATE VIRTUAL TABLE vec_employees USING vec0(
     employee_id TEXT PRIMARY KEY,
     embed FLOAT[1536] distance_metric=cosine
   );
   ```

3. **Similarity search**: Uses `MATCH` syntax for vector queries:
   ```sql
   SELECT * FROM vec_employees
   WHERE embed MATCH vec_f32(?)
   AND k = 10
   AND distance <= 0.5
   ORDER BY distance ASC;
   ```

### Platform-Specific Notes

#### Linux (Ubuntu/Debian)

The npm package includes pre-built binaries. If you encounter issues:

```bash
# Ensure build tools are installed
sudo apt-get install build-essential python3

# Rebuild native modules
npm rebuild better-sqlite3
npm rebuild
```

#### macOS

```bash
# Install Xcode Command Line Tools if needed
xcode-select --install

# If using Apple Silicon (M1/M2), ensure Rosetta 2 is installed for older binaries
softwareupdate --install-rosetta

# Rebuild if needed
npm rebuild
```

#### Windows

```bash
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Or use windows-build-tools
npm install --global windows-build-tools

# Rebuild native modules
npm rebuild
```

### Manual Extension Compilation (Advanced)

If pre-built binaries don't work, compile from source:

```bash
# Clone sqlite-vec repository
git clone https://github.com/asg017/sqlite-vec.git
cd sqlite-vec

# Build (requires make and a C compiler)
make

# The resulting .so/.dylib/.dll can be loaded manually
```

---

## GCS Bucket Setup

Google Cloud Storage is used to persist the database in production. The server downloads the database on startup and uploads it after refresh operations.

### Step 1: Create the GCS Bucket

```bash
# Create bucket (choose a unique name)
gcloud storage buckets create gs://your-mcp-database-bucket \
  --location=europe-north1 \
  --default-storage-class=STANDARD

# Verify creation
gcloud storage buckets list
```

### Step 2: Set Bucket Permissions

For Cloud Run deployments, the service account needs access:

```bash
# Get your Cloud Run service account
# Format: PROJECT_NUMBER-compute@developer.gserviceaccount.com

# Grant Storage Object Admin role
gcloud storage buckets add-iam-policy-binding gs://your-mcp-database-bucket \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin"
```

For local development with Application Default Credentials:

```bash
# Login with your user account
gcloud auth application-default login
```

### Step 3: Upload Initial Database

After creating the database locally, upload it to GCS:

```bash
# Upload the development database to GCS
gcloud storage cp development-db.sqlite gs://your-mcp-database-bucket/talent-network.sqlite

# Verify upload
gcloud storage ls gs://your-mcp-database-bucket/
```

**Note**: The production database filename is `talent-network.sqlite` (defined in `src/constants.mjs`).

### Step 4: Verify GCS Configuration

```bash
# Download to verify it works
gcloud storage cp gs://your-mcp-database-bucket/talent-network.sqlite /tmp/test-download.sqlite

# Check file size
ls -lh /tmp/test-download.sqlite
```

---

## Environment Variables

### Complete Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | Yes | - | Authentication key for API endpoints |
| `AGILEDAY_BASE_URL` | Yes | - | Base URL of your Agileday instance |
| `OPENAI_KEY` | Yes | - | OpenAI API key for embeddings |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `GCS_BUCKET` | Production | - | GCS bucket name for database storage |
| `PORT` | No | `8080` | Server port |
| `GOOGLE_CLIENT_ID` | OAuth | - | For Custom GPT integration |
| `GOOGLE_CLIENT_SECRET` | OAuth | - | For Custom GPT integration |

> **Note:** `AGILEDAY_TOKEN` is NOT an environment variable. It's passed as a body parameter when calling the `/refresh` endpoint. See the [Database Initialization](#database-initialization) section for usage.

### Database-Specific Behavior

| Environment | Database Path | GCS Operations |
|-------------|--------------|----------------|
| `development` | `./development-db.sqlite` | Skipped |
| `production` | `/tmp/talent-network.sqlite` | Download on startup, upload after refresh |
| `test` | `./development-db.sqlite` | Skipped |

### Example `.env` File

```env
# Authentication
API_KEY=abc123def456...  # Generate with: openssl rand -hex 32

# Agileday API
AGILEDAY_BASE_URL=https://api.agileday.com

# OpenAI (for embeddings)
OPENAI_KEY=sk-...

# Environment
NODE_ENV=development

# Production only
# GCS_BUCKET=my-mcp-database-bucket

# OAuth (optional, for Custom GPT)
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
```

---

## Verification Steps

### 1. Verify Local Database

After running refresh, check the database was created:

```bash
# Check file exists and has reasonable size
ls -lh development-db.sqlite

# Expected output (size varies based on data):
# -rw-r--r-- 1 user user 2.5M Jan 15 10:00 development-db.sqlite
```

### 2. Verify Database Contents

Use SQLite CLI to inspect:

```bash
sqlite3 development-db.sqlite

# Check tables exist
.tables
# Expected: employee_availability  employee_skills  openings  vec_employees
#           employee_certificates  employees        project_history  vec_projects

# Count records
SELECT COUNT(*) FROM employees;
SELECT COUNT(*) FROM vec_employees;
SELECT COUNT(*) FROM project_history;

# Exit
.quit
```

### 3. Verify via Server Health Check

Start the server and check logs:

```bash
npm run dev
```

Expected output on startup:

```
⚙️ Server name: mcp-talent-network
📘 Server version: X.Y.Z (version varies)
🧱 Local mode — skipping GCS download
🔎 Checking database...
👷 45 employees found in the database!
📁 128 projects found in the database!
📤 45 employees descriptions vectors found!
⭕ 128 projects descriptions vectors found!
🎯 52 openings found in the database!
🚀 Listening on :8080
```

### 4. Test Search Functionality

```bash
# Test a search query
curl -s "http://localhost:8080/api/v1/search?q=react&api_key=YOUR_API_KEY" | jq

# Expected: Array of candidates matching "react"
```

### 5. Verify GCS Upload (Production)

```bash
# List bucket contents
gcloud storage ls -l gs://your-bucket/talent-network.sqlite

# Check upload timestamp matches your last refresh
```

---

## Troubleshooting

### Vector Extension Loading Errors

**Error**: `Error: Cannot find module 'sqlite-vec'`

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Error**: `Error: dlopen failed: cannot load library`

**Solution** (platform-specific binary issues):
```bash
# Force rebuild native modules
npm rebuild better-sqlite3
npm rebuild sqlite-vec

# On Linux, ensure glibc is up to date
ldd --version
```

### Database Not Found

**Error**: `⛲ DB not found skipping database check`

**Solution**: Run the refresh endpoint to create the database:
```bash
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token": "AGILEDAY_TOKEN"}' \
  "http://localhost:8080/api/v1/refresh"
```

### Embeddings Generation Fails

**Error**: `Error: 401 Unauthorized` from OpenAI

**Solution**: Verify your OpenAI key has embeddings access:
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Ensure the key has "Model capabilities → Write" permission
3. Test the key: `curl https://api.openai.com/v1/models -H "Authorization: Bearer YOUR_KEY"`

**Error**: `Fixture not found for text...` (in tests)

**Solution**: This means the mock server doesn't have cached embeddings. For tests:
```bash
# Capture new embeddings fixtures
export OPENAI_KEY=your-real-key
node test/scripts/capture-refresh-embeddings.mjs
node test/scripts/generate-fixture-index.mjs
```

### GCS Permission Errors

**Error**: `Error: The caller does not have permission`

**Solution**:
```bash
# For local development
gcloud auth application-default login

# For Cloud Run, verify service account permissions
gcloud storage buckets get-iam-policy gs://your-bucket
```

**Error**: `Error: The specified bucket does not exist`

**Solution**:
```bash
# Verify bucket name
gcloud storage buckets list | grep your-bucket

# Check GCS_BUCKET environment variable matches exactly
echo $GCS_BUCKET
```

### Database Lock Errors

**Error**: `SQLITE_BUSY: database is locked`

**Solution**:
- Ensure only one process accesses the database
- Close any SQLite CLI sessions
- Restart the server

### Memory Issues with Large Datasets

**Error**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

---

## Quick Reference

### Development Setup (Fresh Start)

```bash
# 1. Clone and install
git clone <repo>
cd talent-network
nvm use
npm install

# 2. Set environment
export API_KEY=$(openssl rand -hex 32)
export AGILEDAY_BASE_URL="https://your-agileday.com"
export OPENAI_KEY="sk-..."
export NODE_ENV="development"

# 3. Start server
npm run dev

# 4. Initialize database (in another terminal)
curl -X POST -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_AGILEDAY_HR_TOKEN"}' \
  "http://localhost:8080/api/v1/refresh"

# 5. Verify
curl "http://localhost:8080/api/v1/search?q=developer&api_key=$API_KEY"
```

### Production Setup

```bash
# 1. Create GCS bucket
gcloud storage buckets create gs://your-bucket --location=europe-north1

# 2. Initialize locally first
NODE_ENV=development npm run dev
# ... run refresh ...

# 3. Upload to GCS
gcloud storage cp development-db.sqlite gs://your-bucket/talent-network.sqlite

# 4. Deploy to Cloud Run (via GitHub Actions or manually)
# See README.md for deployment instructions
```
