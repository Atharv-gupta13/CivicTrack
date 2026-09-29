# CivicTrack — deploying to Netlify

Camera and location need HTTPS to work for other people (not just you on
localhost). Netlify gives every deploy free HTTPS automatically — that part
is already solved just by hosting there.

The other piece — **letting other people's uploaded photos be seen by
everyone** — needs somewhere to store data. Netlify Drop (plain drag & drop)
only serves static files, it can't run a server. So this project uses
**Supabase** (free tier) as that storage, called directly from the browser.
No server, no functions, no build step — works perfectly with drag & drop.

## One-time setup (~5 minutes)

1. Go to https://supabase.com → create a free account → **New project**.
2. Once it's ready, open **SQL Editor** → paste the contents of
   `supabase-setup.sql` from this folder → **Run**.
3. Go to **Storage** → **New bucket** → name it exactly `civic-photos` →
   turn **Public bucket** ON → **Create bucket**.
4. Go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
5. Open `config.js` in this folder and paste them in:
   ```js
   window.CIVICTRACK_SUPABASE = {
     url: "https://xxxxxxxx.supabase.co",
     anonKey: "eyJ....your-anon-key...."
   };
   ```
   Save the file.

## Deploy to Netlify

1. Go to https://app.netlify.com/drop
2. Drag this whole folder in (`index.html`, `style.css`, `script.js`,
   `ui.js`, `config.js`, `netlify.toml` — all together, same folder).
3. Netlify gives you a live `https://…netlify.app` link immediately.
4. Open that link on your own phone and a friend's phone — verify location,
   take/upload a photo, tick "Share this report", save. It'll show up in
   **Community reports** on both phones.

To update the site later, edit files locally and drag the folder onto the
same site's **Deploys** page again.

## Why camera/location wouldn't work before

- On plain `http://` (or a raw IP address), browsers block camera and
  location for everyone except you on `localhost`. Netlify's automatic
  HTTPS fixes this for every visitor.
- If a phone still blocks it: the person must tap **Allow** on the
  browser's permission prompt (not the site's own button) the first time,
  and iPhones need Safari — a webview opened from inside Instagram/WhatsApp
  will block camera access regardless of hosting.
- `netlify.toml` in this folder also sets a `Permissions-Policy` header so
  nothing at the hosting level can block these two permissions.

## Running it locally instead (optional, for testing before you deploy)

    node server.js

Open `http://localhost:3000`. This uses the included `server.js` (writes to
local `uploads/`/`data/` folders) instead of Supabase — only useful for
your own machine, not for Netlify. Leave `CIVICTRACK_SUPABASE` empty in
`config.js` for this mode; the app falls back to `CIVICTRACK_API`
automatically.
