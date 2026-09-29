const consent = document.getElementById("consent");
const locationBtn = document.getElementById("locationBtn");
const locationStatus = document.getElementById("locationStatus");

const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const cameraBtn = document.getElementById("cameraBtn");
const captureBtn = document.getElementById("captureBtn");

const preview = document.getElementById("preview");
const saveBtn = document.getElementById("saveBtn");

const captureMessage = document.getElementById("captureMessage");
const status = document.getElementById("status");
const records = document.getElementById("records");

const locationPopup = document.getElementById("locationPopup");

const evidencePopup = document.getElementById("evidencePopup");
const evidenceImage = document.getElementById("evidenceImage");
const evidenceInfo = document.getElementById("evidenceInfo");
const closeEvidence = document.getElementById("closeEvidence");

const clearBtn = document.getElementById("clearBtn");

const stepEls = document.querySelectorAll(".action-step");
const addressPreview = document.getElementById("addressPreview");
const shareToggle = document.getElementById("shareToggle");
const issueCategory = document.getElementById("issueCategory");
const issueSeverity = document.getElementById("issueSeverity");
const issueDetails = document.getElementById("issueDetails");
const API_BASE = (window.CIVICTRACK_API || "").replace(/\/$/, "");
const locationStateMark = document.getElementById("locationStateMark");

let userLocation = null;
let selectedPhoto = null;
let cameraStream = null;
let db = null;


/* =========================
   VISUAL STAGE
========================= */

function setStage(stage) {
    const idx = { location: 0, capture: 0, record: 1, done: 2 }[stage] || 0;
    stepEls.forEach((el, i) => el.classList.toggle("active", i <= idx));
}

/* HTML-escape anything typed by users before putting it in innerHTML */
function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

/* =========================
   PLACE NAME (reverse geocoding via OpenStreetMap Nominatim, no API key)
========================= */

async function reverseGeocode(lat, lon) {
    const lang = localStorage.getItem("civictrack:language") || "en";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1" +
            "&lat=" + lat + "&lon=" + lon + "&accept-language=" + lang + ",en";
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error("geocode " + res.status);
        const j = await res.json();
        const a = j.address || {};
        const parts = [
            a.road || a.pedestrian || a.hamlet,
            a.neighbourhood || a.suburb || a.village,
            a.city || a.town || a.county || a.state_district,
            a.state,
            a.postcode
        ].filter(Boolean);
        return parts.length ? parts.join(", ") : (j.display_name || null);
    } catch (e) {
        console.warn("Place name lookup failed:", e);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/* Shrink photo (max 1024px wide) so storage and upload stay light */
function drawScaled(video) {
    const scale = Math.min(1, 1024 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}


/* =========================
   DATABASE
========================= */

const request = indexedDB.open("LocationPhotoDB", 1);

request.onupgradeneeded = function (event) {
    db = event.target.result;

    if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", {
            keyPath: "id",
            autoIncrement: true
        });
    }
};

request.onsuccess = function (event) {
    db = event.target.result;
    loadRecords();
};

request.onerror = function (event) {
    console.error("Database error:", event.target.error);
};


/* =========================
   CONSENT
========================= */

consent.addEventListener("change", function () {
    if (consent.checked) {
        locationBtn.disabled = false;
        captureMessage.textContent =
            "Permission received. Verify your location before opening the camera.";
        status.textContent = "";
    } else {
        locationBtn.disabled = true;
        cameraBtn.disabled = true;
        uploadBtn.disabled = true;
        captureBtn.disabled = true;

        userLocation = null;

        locationStatus.innerHTML =
            '<span class="status-dot"></span> Location not verified';

        locationStatus.classList.remove("location-success");
        locationBtn.textContent = "Verify location";

        locationStateMark.textContent = "—";
        addressPreview.textContent = "";

        captureMessage.textContent =
            "Location permission is required before evidence can be captured.";

        status.textContent = "";
        setStage("location");
    }
});


/* =========================
   LOCATION
========================= */

locationBtn.addEventListener("click", function () {
    if (!consent.checked) {
        alert("Please provide consent first.");
        return;
    }

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }

    locationPopup.classList.remove("hidden");

    navigator.geolocation.getCurrentPosition(
        function (position) {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            locationPopup.classList.add("hidden");

            locationStatus.innerHTML =
                '<span class="status-dot"></span> Location verified';

            locationStatus.classList.add("location-success");

            locationBtn.textContent = "Location verified";
            locationBtn.disabled = true;

            locationStateMark.textContent = "✓";
            locationStateMark.style.color = "#24634f";
            locationStateMark.style.borderColor = "#24634f";

            cameraBtn.disabled = false;
            uploadBtn.disabled = false;

            captureMessage.textContent =
                "Position established. You can now open the camera.";

            status.textContent =
                "GPS accuracy: approximately " +
                Math.round(userLocation.accuracy) +
                " metres.";

            status.style.color = "#24634f";

            setStage("capture");

            addressPreview.textContent = "Finding place name…";
            reverseGeocode(userLocation.latitude, userLocation.longitude).then(function (name) {
                if (!userLocation) return;
                userLocation.placeName = name;
                addressPreview.textContent = name
                    ? "📍 " + name + "  (" + userLocation.latitude.toFixed(5) + ", " + userLocation.longitude.toFixed(5) + ")"
                    : "Coordinates verified: " + userLocation.latitude.toFixed(6) + ", " + userLocation.longitude.toFixed(6) + " (place name unavailable offline)";
            });
        },

        function (error) {
            locationPopup.classList.add("hidden");

            userLocation = null;

            locationStatus.innerHTML =
                '<span class="status-dot"></span> Location access denied';

            locationStatus.classList.remove("location-success");

            locationStateMark.textContent = "!";
            locationStateMark.style.color = "#9d3830";
            locationStateMark.style.borderColor = "#9d3830";

            cameraBtn.disabled = true;
            uploadBtn.disabled = true;
            captureBtn.disabled = true;

            captureMessage.textContent =
                "Location verification failed. Allow location access and try again.";

            status.textContent =
                "Location permission is required to continue.";

            status.style.color = "#9d3830";

            setStage("location");

            console.error("Location error:", error);
        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
});


/* =========================
   CAMERA ACCESS
========================= */

cameraBtn.addEventListener("click", async function () {
    if (!userLocation) {
        alert("Please verify your location first.");
        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        alert("Camera access is not supported by this browser.");
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        camera.srcObject = cameraStream;
        camera.style.display = "block";

        const placeholder = document.querySelector(".camera-empty");
        if (placeholder) {
            placeholder.style.display = "none";
        }

        captureBtn.disabled = false;

        cameraBtn.textContent = "Camera ready";
        cameraBtn.disabled = true;

        captureMessage.textContent =
            "Camera ready. Frame the infrastructure and capture the scene.";

        status.textContent = "Camera access granted.";
        status.style.color = "#24634f";

        setStage("capture");

    } catch (error) {
        console.error("Camera error:", error);

        alert(
            "Camera access was denied. Please allow camera permission in your browser."
        );

        status.textContent = "Camera blocked. Use “Upload / use phone camera” instead.";
        status.style.color = "#9d3830";
    }
});


/* =========================
   CAPTURE PHOTO
========================= */

captureBtn.addEventListener("click", function () {
    if (!userLocation) {
        alert("Location verification is required.");
        return;
    }

    if (!cameraStream) {
        alert("Please allow camera access first.");
        return;
    }

    const width = camera.videoWidth;
    const height = camera.videoHeight;

    if (width === 0 || height === 0) {
        alert("Camera is not ready yet. Please wait.");
        return;
    }

    drawScaled(camera);

    canvasToPhoto();
});


function canvasToPhoto() {
    canvas.toBlob(
        function (blob) {
            if (!blob) {
                alert("Could not capture photo.");
                return;
            }

            selectedPhoto = new File(
                [blob],
                "captured-photo.jpg",
                { type: "image/jpeg" }
            );

            preview.src = URL.createObjectURL(selectedPhoto);
            preview.style.display = "block";

            saveBtn.disabled = false;

            captureMessage.textContent =
                "Frame captured. Review it below before saving.";

            status.textContent =
                "Evidence is ready to be recorded.";

            status.style.color = "#1e566f";

            setStage("record");
        },
        "image/jpeg",
        0.8
    );
}

/* Fallback when live camera is blocked/unsupported (e.g. in-app browsers, some iPhones):
   opens the phone's own camera / gallery picker instead. */
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
uploadBtn.addEventListener("click", function () {
    if (!userLocation) { alert("Please verify your location first."); return; }
    fileInput.click();
});
fileInput.addEventListener("change", function () {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = function () {
        const scale = Math.min(1, 1024 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(img.src);
        canvasToPhoto();
    };
    img.onerror = function () { alert("Could not read that image."); };
    img.src = URL.createObjectURL(file);
    fileInput.value = "";
});


/* =========================
   SAVE PHOTO
========================= */

saveBtn.addEventListener("click", function () {
    if (!selectedPhoto) {
        alert("Please capture a photo first.");
        return;
    }

    if (!userLocation) {
        alert("Location verification is required.");
        return;
    }

    if (!db) {
        alert("Local record is not ready yet.");
        return;
    }

    if (!issueCategory.value) {
        status.textContent = "Please select an issue category before saving.";
        status.style.color = "#9d3830";
        issueCategory.focus();
        return;
    }

    const record = {
        ticket: "CT-LOCAL-" + (Math.floor(Math.random() * 90000) + 10000),
        category: issueCategory.value,
        severity: issueSeverity.value,
        details: issueDetails.value.trim(),
        placeName: userLocation.placeName || null,
        shared: !!(shareToggle && shareToggle.checked),
        photo: selectedPhoto,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracy: userLocation.accuracy,
        capturedAt: new Date().toISOString(),
        consent: true
    };

    const transaction = db.transaction(
        ["photos"],
        "readwrite"
    );

    const store = transaction.objectStore("photos");
    store.add(record);

    transaction.oncomplete = function () {
        status.textContent =
            "Evidence recorded locally with location and capture time.";

        status.style.color = "#24634f";

        if (window.onReportSaved) window.onReportSaved(record);
        if (record.shared) shareReport(record);
        issueDetails.value = "";

        selectedPhoto = null;
        preview.src = "";
        preview.style.display = "none";
        saveBtn.disabled = true;

        setStage("done");
        loadRecords();
    };

    transaction.onerror = function (event) {
        console.error("Save error:", event.target.error);

        status.textContent =
            "The evidence could not be saved.";

        status.style.color = "#9d3830";
    };
});


/* =========================
   SHARE WITH OTHERS (server storage)
========================= */

const SB = window.CIVICTRACK_SUPABASE || {};
const useSupabase = !!(SB.url && SB.anonKey);
const sbHeaders = (extra) => Object.assign({ apikey: SB.anonKey, Authorization: "Bearer " + SB.anonKey }, extra || {});

async function shareReport(record) {
    try {
        if (useSupabase) {
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            const up = await fetch(SB.url + "/storage/v1/object/civic-photos/" + id + ".jpg", {
                method: "POST", headers: sbHeaders({ "Content-Type": "image/jpeg" }), body: record.photo
            });
            if (!up.ok) throw new Error("photo upload " + up.status);
            const ins = await fetch(SB.url + "/rest/v1/reports", {
                method: "POST",
                headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
                body: JSON.stringify({
                    ticket: record.ticket, category: record.category, severity: record.severity,
                    details: record.details, place_name: record.placeName,
                    latitude: record.latitude, longitude: record.longitude, accuracy: record.accuracy,
                    captured_at: record.capturedAt,
                    photo_url: SB.url + "/storage/v1/object/public/civic-photos/" + id + ".jpg"
                })
            });
            if (!ins.ok) throw new Error("insert " + ins.status);
        } else {
            const photo = await blobToDataURL(record.photo);
            const res = await fetch(API_BASE + "/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket: record.ticket, category: record.category, severity: record.severity,
                    details: record.details, placeName: record.placeName,
                    latitude: record.latitude, longitude: record.longitude,
                    accuracy: record.accuracy, capturedAt: record.capturedAt, photo: photo
                })
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
        }
        status.textContent = "Saved on this device and shared in Community reports.";
        status.style.color = "#24634f";
    } catch (e) {
        console.warn("Share failed:", e);
        status.textContent = "Saved on this device only. Sharing failed (check internet / storage setup).";
        status.style.color = "#8a5a00";
    }
}

/* Returns shared reports in one shape, whichever backend is used */
async function fetchSharedReports() {
    if (useSupabase) {
        const res = await fetch(SB.url + "/rest/v1/reports?select=*&order=created_at.desc&limit=100", { headers: sbHeaders() });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return (await res.json()).map(r => ({
            ticket: r.ticket, category: r.category, severity: r.severity, details: r.details,
            placeName: r.place_name, latitude: r.latitude, longitude: r.longitude,
            capturedAt: r.captured_at, photoUrl: r.photo_url
        }));
    }
    const res = await fetch(API_BASE + "/api/reports");
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).map(r => Object.assign({}, r, { photoUrl: API_BASE + r.photoUrl }));
}

/* =========================
   LOAD RECORDS
========================= */

function loadRecords() {
    if (!db) {
        return;
    }

    const transaction = db.transaction(
        ["photos"],
        "readonly"
    );

    const store = transaction.objectStore("photos");
    const request = store.getAll();

    request.onsuccess = function () {
        const data = request.result;

        if (data.length === 0) {
            records.innerHTML = `
                <div class="empty-record">
                    <span class="empty-number">00</span>
                    <div>
                        <strong>No evidence yet.</strong>
                        <p>Your saved field photographs will appear here.</p>
                    </div>
                </div>
            `;
            return;
        }

        records.innerHTML = "";

        data.reverse().forEach(function (record, index) {
            const div = document.createElement("div");
            div.className = "record";

            const imageURL = URL.createObjectURL(record.photo);

            div.innerHTML = `
                <img src="${imageURL}" alt="Captured field evidence">

                <div class="record-data">
                    <p>
                        <strong>Record</strong>
                        ${String(data.length - index).padStart(2, "0")}
                        ${record.ticket ? "· " + esc(record.ticket) : ""}
                        ${record.shared ? "· shared" : ""}
                    </p>

                    ${record.category ? `<p><strong>Issue</strong> ${esc(record.category)} (${esc(record.severity)})</p>` : ""}
                    ${record.placeName ? `<p><strong>Place</strong> ${esc(record.placeName)}</p>` : ""}

                    <p>
                        <strong>Coordinates</strong>
                        ${record.latitude.toFixed(6)},
                        ${record.longitude.toFixed(6)}
                    </p>

                    <p>
                        <strong>Captured</strong>
                        ${new Date(record.capturedAt).toLocaleString()}
                    </p>

                    <p>
                        <strong>GPS accuracy</strong>
                        ${Math.round(record.accuracy)} metres
                    </p>

                    <button class="view-button">
                        Open full record
                    </button>
                </div>
            `;

            const viewButton = div.querySelector(".view-button");

            viewButton.addEventListener("click", function () {
                showEvidence(record);
            });

            records.appendChild(div);
        });
    };

    request.onerror = function (event) {
        console.error(
            "Could not load records:",
            event.target.error
        );
    };
}


/* =========================
   SHOW FULL EVIDENCE
========================= */

function showEvidence(record) {
    const imageURL = URL.createObjectURL(record.photo);

    evidenceImage.src = imageURL;

    evidenceInfo.innerHTML = `
        ${record.placeName ? `<div class="info"><strong>Place</strong> ${esc(record.placeName)}</div>` : ""}
        ${record.category ? `<div class="info"><strong>Issue</strong> ${esc(record.category)} (${esc(record.severity)})</div>` : ""}
        ${record.details ? `<div class="info"><strong>Description</strong> ${esc(record.details)}</div>` : ""}
        <div class="info">
            <strong>Latitude</strong>
            ${record.latitude.toFixed(6)}
        </div>

        <div class="info">
            <strong>Longitude</strong>
            ${record.longitude.toFixed(6)}
        </div>

        <div class="info">
            <strong>GPS accuracy</strong>
            Approximately ${Math.round(record.accuracy)} metres
        </div>

        <div class="info">
            <strong>Captured at</strong>
            ${new Date(record.capturedAt).toLocaleString()}
        </div>

        <div class="info">
            <strong>Location consent</strong>
            Granted
        </div>
    `;

    evidencePopup.classList.remove("hidden");
}


/* =========================
   CLOSE EVIDENCE
========================= */

closeEvidence.addEventListener("click", function () {
    evidencePopup.classList.add("hidden");
});

evidencePopup.addEventListener("click", function (event) {
    if (event.target === evidencePopup) {
        evidencePopup.classList.add("hidden");
    }
});


/* =========================
   CLEAR LOCAL RECORD
========================= */

clearBtn.addEventListener("click", function () {
    const confirmDelete = confirm(
        "Are you sure you want to delete all locally saved evidence?"
    );

    if (!confirmDelete) {
        return;
    }

    if (!db) {
        return;
    }

    const transaction = db.transaction(
        ["photos"],
        "readwrite"
    );

    const store = transaction.objectStore("photos");
    store.clear();

    transaction.oncomplete = function () {
        records.innerHTML = `
            <div class="empty-record">
                <span class="empty-number">00</span>
                <div>
                    <strong>No evidence yet.</strong>
                    <p>Your saved field photographs will appear here.</p>
                </div>
            </div>
        `;

        status.textContent = "Local evidence record cleared.";
        status.style.color = "#9d3830";

        setStage("location");
    };
});


/* =========================
   CLEANUP
========================= */

window.addEventListener("beforeunload", function () {
    if (cameraStream) {
        cameraStream.getTracks().forEach(
            track => track.stop()
        );
    }
});
