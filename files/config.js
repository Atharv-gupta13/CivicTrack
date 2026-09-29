// CivicTrack configuration.
// This file is loaded before script.js — it is the ONLY file you need to edit
// after following the Supabase steps in README.md.

// Option A (recommended for Netlify): fill these in and shared reports work
// straight from the browser, no server needed at all.
window.CIVICTRACK_SUPABASE = {
  url: "",      // e.g. "https://xxxxxxxx.supabase.co"
  anonKey: ""   // Supabase "anon public" key (safe to expose in frontend code)
};

// Option B (only if you're self-hosting server.js on a Node host instead of
// Netlify): leave CIVICTRACK_SUPABASE empty above and put your server's URL
// here. Leave "" if the server is on the same domain as this page.
window.CIVICTRACK_API = "";
