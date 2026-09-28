# CivicTrack

Run (Node 16+, no npm install):

    node server.js

Open http://localhost:3000

- Reports marked "Share" are stored on the server (`data/reports.json` + `uploads/`) and appear in the **Community reports** tab for everyone using that server.
- Camera + GPS need HTTPS or localhost. To let others on phones use it, deploy to a host with HTTPS (Render / Railway / Fly) or tunnel with ngrok.
- If the frontend is hosted separately, set `window.CIVICTRACK_API` in index.html to the server URL.
