// CivicTrack shared storage server. No npm install needed (Node 16+).
// Run:  node server.js   ->  open http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const DB_FILE = path.join(ROOT, "data", "reports.json");
const MAX_BODY = 6 * 1024 * 1024; // 6 MB per report

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

const readDB = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) { return []; } };
const writeDB = (d) => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".json": "application/json" };
const CATEGORIES = ["Pothole / damaged road", "Garbage / sanitation", "Streetlight", "Water leakage",
  "Drainage / flooding", "Electricity", "Public property damage", "Other"];
const SEVERITIES = ["Normal", "Urgent", "Safety risk"];

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") return send(res, 204, "");

  // ---- API: list shared reports (newest first) ----
  if (req.method === "GET" && url.pathname === "/api/reports") {
    return send(res, 200, readDB().slice(-100).reverse());
  }

  // ---- API: create a shared report ----
  if (req.method === "POST" && url.pathname === "/api/reports") {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { send(res, 413, { error: "Photo too large" }); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const b = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.photo || "");
        const lat = Number(b.latitude), lon = Number(b.longitude);
        if (!m || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          return send(res, 400, { error: "Invalid photo or coordinates" });
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        fs.writeFileSync(path.join(UPLOADS, id + ".jpg"), Buffer.from(m[1], "base64"));
        const report = {
          id,
          ticket: clip(b.ticket, 30),
          category: CATEGORIES.includes(b.category) ? b.category : "Other",
          severity: SEVERITIES.includes(b.severity) ? b.severity : "Normal",
          details: clip(b.details, 1000),
          placeName: clip(b.placeName, 300),
          latitude: lat, longitude: lon,
          accuracy: Number(b.accuracy) || 0,
          capturedAt: new Date(b.capturedAt).toString() === "Invalid Date" ? new Date().toISOString() : b.capturedAt,
          photoUrl: "/uploads/" + id + ".jpg"
        };
        const db = readDB(); db.push(report); writeDB(db);
        send(res, 201, report);
      } catch (e) { send(res, 400, { error: "Bad request" }); }
    });
    return;
  }

  // ---- Static files (index.html, css, js, uploads) ----
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(ROOT, rel));
  const allowed = ["index.html", "style.css", "script.js", "ui.js"].map((f) => path.join(ROOT, f));
  const ok = allowed.includes(file) || (file.startsWith(UPLOADS + path.sep) && file.endsWith(".jpg"));
  if (!ok) return send(res, 404, "Not found", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, TYPES[path.extname(file)] || "application/octet-stream");
  });
});

server.listen(PORT, () => console.log("CivicTrack running at http://localhost:" + PORT));
