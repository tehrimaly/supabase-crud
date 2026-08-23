# Supabase CRUD App: Database + Storage + Edge Functions

A full CRUD system built on Supabase, covering file storage, database tables, and a server-side Edge Function for validation. The project has two interfaces: a Python terminal app and a Next.js web app, both talking to the same Supabase backend.
<img width="1001" height="497" alt="image" src="https://github.com/user-attachments/assets/f00222b1-dac7-4ff7-8296-b82a0225b2a3" />


## What this project does

1. Uploads files to Supabase Storage and stores their metadata in Postgres.
2. Lists and downloads files.
3. Updates file metadata and replaces files.
4. Deletes files from both storage and the database.
5. Validates every uploaded file server-side through a Supabase Edge Function before it's stored, so validation logic can never be bypassed by a client.
6. Runs the same CRUD pattern against a plain Postgres table (`items`), separate from file storage.

## Architecture

```
                        ┌─────────────────────┐
                        │   Supabase Project   │
                        │                       │
   ┌──────────────┐     │  ┌─────────────────┐ │
   │  Python CLI   │────▶│  │ files_metadata  │ │
   │  (main.py)    │     │  │ items (table)   │ │
   └──────────────┘     │  └─────────────────┘ │
                        │                       │
   ┌──────────────┐     │  ┌─────────────────┐ │
   │  Next.js Web  │────▶│  │  Storage bucket │ │
   │  App (Vercel) │     │  │  "user-files"   │ │
   └──────────────┘     │  └─────────────────┘ │
                        │                       │
                        │  ┌─────────────────┐ │
                        │  │ Edge Function:   │ │
          upload  ─────▶│  │ validate-file    │ │
          request      │  │ (Deno)           │ │
                        │  └─────────────────┘ │
                        └─────────────────────┘
```

Both interfaces call the same Edge Function as part of their Create step, before the file ever reaches Storage.

## Tech stack

1. Supabase (Postgres database, Storage, Edge Functions on Deno).
2. Python with the `supabase-py` SDK for the terminal app.
3. Next.js (App Router) with the `@supabase/supabase-js` SDK for the web app.
4. TypeScript for both the Edge Function and the Next.js API routes.
5. Vercel for hosting the web app.

## Part 1: Supabase project setup

1. Created a project at app.supabase.com named `crud-storage-app`.
2. Ran the SQL in `schema.sql` through the SQL Editor to create two tables:
   - `files_metadata`: stores filename, storage path, uploader, file type and size, timestamps, and validation results.
   - `items`: a plain table for the standalone table-CRUD requirement.
3. Created a private Storage bucket named `user-files`.
4. Retrieved the project URL and the legacy `service_role` key from Project Settings → API Keys → "Legacy anon, service_role API keys" tab. This is the key format the Edge Function's bearer-token authorization accepts; the newer `sb_secret_...` key format returned 401 errors when tested.

## Part 2: Terminal CRUD app (Python)

Located in `supabase-crud-app/`.

| File | Purpose |
|---|---|
| `config.py` | Loads environment variables and creates the Supabase client. |
| `storage_crud.py` | Create, read, update, delete for files, including the Edge Function call on upload. |
| `table_crud.py` | Create, read, update, delete for the `items` table. |
| `main.py` | Terminal menu tying both together. |

Run with:

```bash
pip install -r requirements.txt
python main.py
```

Environment variables (`.env`):

```
SUPABASE_URL=https://cchonwezwezyifksdmxq.supabase.co
SUPABASE_KEY=<legacy service_role key>
BUCKET_NAME=user-files
```

### Verified working

1. Created three rows in `items` through the terminal menu and confirmed them in the Supabase Table Editor.
2. Uploaded a PDF to Storage; metadata row created with `validated=True`.
3. Confirmed the file appears in the Storage bucket in the dashboard.

## Part 3: Edge Function (server-side validation)

Located in `supabase-crud-app/edge_functions/validate-file/index.ts`.

The function runs on Deno, receives `{ filename, size, mimetype }`, and checks:

1. The mimetype against an allow-list (PDF, PNG, JPEG, plain text, CSV, Word documents).
2. The file size against a 10 MB limit.
3. That the file isn't empty.

It returns `{ valid, notes, processedAt }`. If `valid` is false, the Python and web apps both stop before the file ever reaches Storage.

### Deployment

```bash
npx supabase login
npx supabase link --project-ref cchonwezwezyifksdmxq
mkdir supabase\functions\validate-file
copy edge_functions\validate-file\index.ts supabase\functions\validate-file\index.ts
npx supabase functions deploy validate-file
```

Note: the CLI's `functions deploy` subcommand worked directly; `functions invoke` was not available in this CLI version, so testing was done with a direct HTTP request instead (see below). Global `npm install -g supabase` did not add the CLI to PATH, so all commands were run through `npx supabase` instead.

### Testing

Tested directly with a PowerShell request, authenticated with the legacy service_role key as a bearer token:

```powershell
Invoke-RestMethod -Uri "https://cchonwezwezyifksdmxq.supabase.co/functions/v1/validate-file" -Method Post -Headers @{"Authorization"="Bearer <legacy-service-role-key>";"Content-Type"="application/json"} -Body '{"filename":"resume.pdf","size":204800,"mimetype":"application/pdf"}'
```

Result: `valid: True, notes: "passed all checks"`.

Also tested a rejection case with an oversized `.exe` file, which correctly returned `valid: False` with notes explaining the mimetype and size violations.

### Confirming integration

Before deployment, uploads from the Python app printed a warning and skipped validation (`Could not reach Edge Function`), while still succeeding. After deployment and switching `SUPABASE_KEY` to the legacy key, the same upload ran without the warning, meaning the Edge Function executed and validated the file server-side as part of the Create step.

## Part 4: Web UI (Next.js, deployed to Vercel)

Located in `supabase-crud-webapp/`. Built because the terminal app cannot run on Vercel; Vercel hosts web requests and serverless functions, not interactive programs waiting on keyboard input.

| Route | Purpose |
|---|---|
| `app/page.tsx` | Upload form and file list with download, edit, and delete actions. |
| `app/api/files/route.ts` | GET (list) and POST (upload, calls the Edge Function, inserts metadata). |
| `app/api/files/[id]/route.ts` | GET (signed download URL), PATCH (update uploader), DELETE. |
| `lib/supabaseAdmin.ts` | Server-only Supabase client using the service_role key; never exposed to the browser. |

### Environment variables (set in Vercel Project Settings, not committed to the repo)

```
SUPABASE_URL=https://cchonwezwezyifksdmxq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<legacy service_role key>
SUPABASE_BUCKET=user-files
```

### Deployment steps

1. Pushed the project to GitHub (`tehrimaly/supabase-crud`).
2. Imported the repo into Vercel as a new project.
3. Added the three environment variables above under Settings → Environment Variables.
4. Redeployed from the Deployments tab after the variables were set.

### Notes for anyone reusing this

1. Never commit a `.env` or `.env.local` file to the repository; both are listed in `.gitignore`. If a `.env` file is ever committed by mistake, remove it from the repo and rotate the exposed key in Supabase immediately, since a public GitHub repo makes the key visible to anyone.
2. Vercel's environment variable names must exactly match what the code reads (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`). A mismatch (for example naming it `SUPABASE_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`) causes the build to fail with a missing-environment-variable error, since the app can't find a variable under a different name.
3. Adding or editing environment variables in Vercel does not automatically rebuild the app; a manual redeploy is required afterward.

## Learning outcomes

1. Supabase functions as a complete backend: Postgres database, object storage, and serverless compute, all provisioned from one dashboard.
2. The Python and JavaScript Supabase SDKs share the same underlying REST and Storage APIs, so the same CRUD logic translates directly between a terminal app and a web app.
3. Edge Functions move validation logic out of the client and onto Supabase's servers, so a malicious or buggy client can't bypass file type or size checks by skipping client-side validation.
4. Key formats matter: Supabase's newer `sb_secret_...` keys and the legacy `service_role` JWT keys are not interchangeable for every use case; the Edge Function's bearer-token authorization specifically required the legacy JWT format during testing.
5. Deploying to a serverless platform like Vercel requires rethinking any interface built around blocking terminal input, since serverless functions handle discrete requests rather than long-running interactive sessions.
