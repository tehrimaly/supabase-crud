# Supabase File Manager (Web UI)

<img width="1022" height="531" alt="image" src="https://github.com/user-attachments/assets/28b56cab-4b33-44ad-ba8a-5421e9f20754" />

A Next.js web app that does the same file CRUD as the terminal Python app
upload, list, download, edit metadata, delete running in the browser, backed
by the same Supabase project and Edge Function you already deployed.

This exists because the terminal Python app can't be hosted on Vercel:
Vercel serves web requests and serverless functions, not interactive
programs that wait on keyboard input. This app wraps the same logic behind a
web page instead.

## How it connects to what you already built

- Same `files_metadata` table, same `user-files` bucket, same `validate-file`
  Edge Function nothing new needed on the Supabase side.
- The Supabase **service_role** key is only ever used inside `app/api/**`
  route handlers (`lib/supabaseAdmin.ts`), which run on the server. It's never
  sent to the browser.

## 1. Test it locally first (optional but recommended)

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your real values (the same ones from your
Python app's `.env`, using the **legacy service_role key** the same one
that worked when you tested the Edge Function directly):

```
SUPABASE_URL=https://cchonwezwezyifksdmxq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-legacy-service-role-key
SUPABASE_BUCKET=user-files
```

Run it:

```bash
npm run dev
```

Open http://localhost:3000 you should see the same files you uploaded from
the terminal app, since it's reading the same table.

## 2. Push this project to GitHub

Vercel deploys from a GitHub (or GitLab/Bitbucket) repo, so this needs to be
in its own repo first.

```bash
git init
git add .
git commit -m "Initial commit: Supabase file manager web app"
```

Create a new empty repo on GitHub (no README/gitignore, since you already
have one), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/supabase-crud-webapp.git
git branch -M main
git push -u origin main
```

## 3. Deploy on Vercel

1. Go to https://vercel.com and sign in (GitHub login is easiest).
2. Click **Add New → Project**.
3. Select the `supabase-crud-webapp` repo you just pushed.
4. Vercel auto-detects Next.js — leave the build settings as default.
5. Before clicking Deploy, expand **Environment Variables** and add:
   - `SUPABASE_URL` = `https://cchonwezwezyifksdmxq.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = your legacy service_role key
   - `SUPABASE_BUCKET` = `user-files`
6. Click **Deploy**. Wait ~1-2 minutes.
7. Vercel gives you a live URL like `supabase-crud-webapp.vercel.app` — open
   it and test upload/download/delete from the browser.

## Notes

- `.env.local` is gitignored — your real keys never get committed or pushed.
- If you ever rotate your service_role key in Supabase, update it in Vercel's
  Project Settings → Environment Variables and redeploy.
- The "Edit" button in the UI only updates the `uploaded_by` field, to keep
  scope small — swap it for a full metadata form if you want to extend it.
