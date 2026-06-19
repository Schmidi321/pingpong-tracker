"use strict";

/* ====================================================================
   Rally Counter – Tischtennis Ballwechsel-Zähler
   Drei Erkennungs-Modi, in den Einstellungen umschaltbar:
     • visual  – Kamera + Frame-Differencing (Bewegung kreuzt Netzlinie)
     • audio   – Web Audio, Onset-/Impuls-Erkennung ("Tock")
     • manual  – Tippen pro Schlag
   ==================================================================== */

const $ = (id) => document.getElementById(id);

const state = {
  mode: "manual",
  running: false,
  current: 0,
  longest: 0,
  last: 0,
  rallies: 0,
  lastHit: 0,
  rallyTimeoutMs: 2500,
  sensitivity: 0.5, // 0..1
  vibrate: true,
};

/* -------------------------------------------------------------------- */
/* Zähl-Kern                                                            */
/* -------------------------------------------------------------------- */
function registerHit() {
  const now = performance.now();
  // Bei zu langer Pause zuerst den alten Ballwechsel abschließen.
  if (state.current > 0 && now - state.lastHit > state.rallyTimeoutMs) endRally();
  state.current += 1;
  state.lastHit = now;
  if (state.current > state.longest) state.longest = state.current;
  if (state.vibrate && navigator.vibrate) navigator.vibrate(18);
  render();
  pulse();
}

function endRally() {
  if (state.current <= 0) return;
  state.last = state.current;
  state.rallies += 1;
  const wasRecord = state.current === state.longest && state.current > 1;
  state.current = 0;
  render();
  if (wasRecord) showToast("🏆 Neuer Rekord: " + state.last + " Schläge");
  else if (state.last > 1) showToast("Ballwechsel: " + state.last + " Schläge");
}

function resetAll() {
  state.current = state.longest = state.last = state.rallies = 0;
  state.lastHit = 0;
  render();
  showToast("Zurückgesetzt");
}

/* Aufräum-Schleife: schließt Ballwechsel nach Pause automatisch ab. */
function housekeeping() {
  if (state.current > 0 && performance.now() - state.lastHit > state.rallyTimeoutMs) {
    endRally();
  }
  requestAnimationFrame(housekeeping);
}

/* -------------------------------------------------------------------- */
/* Rendering                                                            */
/* -------------------------------------------------------------------- */
function render() {
  $("currentValue").textContent = state.current;
  $("longestValue").textContent = state.longest;
  $("lastValue").textContent = state.last;
  $("rallyCount").textContent = state.rallies;
}

function pulse() {
  const card = $("counterCard");
  card.classList.remove("hit");
  void card.offsetWidth; // reflow → Animation neu starten
  card.classList.add("hit");
}

let toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => (t.hidden = true), 250);
  }, 1800);
}

/* ==================================================================== */
/* AUDIO-DETEKTOR                                                       */
/* ==================================================================== */
const audio = {
  ctx: null, analyser: null, stream: null, buf: null,
  armed: true, noiseFloor: 0.02, raf: 0,

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) { return failMedia("Mikrofon", e); }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);
    this.buf = new Uint8Array(this.analyser.fftSize);
    this.armed = true;
    this.loop();
    return true;
  },

  loop() {
    this.analyser.getByteTimeDomainData(this.buf);
    // Spitzen-Abweichung vom Nullpunkt (128) → Impuls-Stärke 0..1
    let peak = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = Math.abs(this.buf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    // gleitender Grundpegel (nur wenn leise) für die Auto-Kalibrierung
    if (peak < 0.08) this.noiseFloor = this.noiseFloor * 0.95 + peak * 0.05;

    // Schwelle: invertierte Empfindlichkeit, oberhalb des Grundpegels
    const threshold = Math.max(this.noiseFloor + 0.04, 1 - state.sensitivity);
    $("audioMeter").style.width = Math.min(100, peak * 100) + "%";
    $("thresholdMarker").style.left = Math.min(100, threshold * 100) + "%";

    // Hysterese gegen Mehrfachzählung eines Schlags
    if (this.armed && peak >= threshold) {
      this.armed = false;
      registerHit();
    } else if (!this.armed && peak < threshold * 0.55) {
      this.armed = true;
    }
    this.raf = requestAnimationFrame(() => this.loop());
  },

  calibrate() {
    // einige Frames lautlos messen → Grundpegel als Basis
    showToast("Ruhig sein … kalibriere");
    const samples = [];
    const t0 = performance.now();
    const grab = () => {
      this.analyser.getByteTimeDomainData(this.buf);
      let p = 0;
      for (let i = 0; i < this.buf.length; i++) p = Math.max(p, Math.abs(this.buf[i] - 128) / 128);
      samples.push(p);
      if (performance.now() - t0 < 900) requestAnimationFrame(grab);
      else {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        this.noiseFloor = avg;
        // Empfindlichkeit so setzen, dass Schwelle knapp über Grundpegel liegt
        setSensitivity(1 - Math.min(0.9, avg + 0.18));
        showToast("Kalibriert ✓");
      }
    };
    if (this.analyser) requestAnimationFrame(grab);
    else showToast("Erst Start drücken");
  },

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close();
    this.ctx = this.analyser = this.stream = null;
  },
};

/* ==================================================================== */
/* VISUAL-DETEKTOR (Frame-Differencing, Kreuzen der Netzlinie)          */
/* ==================================================================== */
const visual = {
  stream: null, raf: 0, W: 160, H: 120,
  prev: null, lastX: 0.5, octx: null,

  async start() {
    const video = $("video");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", frameRate: { ideal: 60 }, width: { ideal: 1280 } },
        audio: false,
      });
    } catch (e) { return failMedia("Kamera", e); }
    video.srcObject = this.stream;
    await video.play().catch(() => {});

    this.proc = document.createElement("canvas");
    this.proc.width = this.W; this.proc.height = this.H;
    this.pctx = this.proc.getContext("2d", { willReadFrequently: true });

    const overlay = $("overlay");
    overlay.width = this.W; overlay.height = this.H;
    this.octx = overlay.getContext("2d");

    this.prev = null;
    this.loop();
    return true;
  },

  loop() {
    const video = $("video");
    if (video.readyState >= 2) {
      this.pctx.drawImage(video, 0, 0, this.W, this.H);
      const img = this.pctx.getImageData(0, 0, this.W, this.H).data;
      const n = this.W * this.H;
      const gray = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        gray[i] = (img[i * 4] * 0.3 + img[i * 4 + 1] * 0.59 + img[i * 4 + 2] * 0.11) | 0;
      }
      if (this.prev) {
        // Pixel-Schwelle aus Empfindlichkeit (12..60)
        const pth = 60 - state.sensitivity * 48;
        let count = 0, sumX = 0;
        this.octx.clearRect(0, 0, this.W, this.H);
        const ov = this.octx.getImageData(0, 0, this.W, this.H);
        for (let i = 0; i < n; i++) {
          if (Math.abs(gray[i] - this.prev[i]) > pth) {
            count++; sumX += i % this.W;
            const o = i * 4;
            ov.data[o] = 56; ov.data[o + 1] = 189; ov.data[o + 2] = 248; ov.data[o + 3] = 150;
          }
        }
        this.octx.putImageData(ov, 0, 0);

        const motion = count / n;
        $("motionMeter").style.width = Math.min(100, motion * 600) + "%";
        // Mindestbewegung, damit Rauschen nicht zählt
        if (motion > 0.004 && count > 0) {
          const cx = sumX / count / this.W; // 0..1
          // Kreuzen der Mittellinie (Netz) = ein Schlag
          if ((this.lastX < 0.5 && cx >= 0.5) || (this.lastX > 0.5 && cx <= 0.5)) {
            registerHit();
          }
          this.lastX = cx;
        }
      }
      this.prev = gray;
    }
    this.raf = requestAnimationFrame(() => this.loop());
  },

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    const v = $("video"); v.srcObject = null;
    if (this.octx) this.octx.clearRect(0, 0, this.W, this.H);
    this.stream = this.prev = null;
  },
};

/* ==================================================================== */
/* Gemeinsame Steuerung                                                 */
/* ==================================================================== */
function failMedia(name, e) {
  console.error(e);
  const secure = window.isSecureContext;
  showToast(secure ? name + " nicht verfügbar" : "Braucht HTTPS oder localhost");
  stop();
  return false;
}

async function start() {
  if (state.running) return;
  if (state.mode === "audio") { if (!(await audio.start())) return; }
  else if (state.mode === "visual") { if (!(await visual.start())) return; }
  state.running = true;
  const btn = $("toggleBtn");
  btn.textContent = state.mode === "manual" ? "Läuft" : "Stopp";
  btn.classList.add("running");
  if (state.mode === "manual") showToast("Los geht's – tippen!");
}

function stop() {
  audio.stop(); visual.stop();
  state.running = false;
  endRally();
  const btn = $("toggleBtn");
  btn.textContent = "Start";
  btn.classList.remove("running");
}

function setMode(mode) {
  if (state.running) stop();
  state.mode = mode;
  ["visual", "audio", "manual"].forEach((m) => ($("panel-" + m).hidden = m !== mode));
  document.querySelectorAll("#modeSelect button").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );
  // Empfindlichkeits-Zeile nur für audio/visual zeigen
  document.querySelectorAll("[data-for]").forEach((el) => {
    const list = el.dataset.for.split(" ");
    el.hidden = !list.includes(mode);
  });
}

function setSensitivity(v) {
  state.sensitivity = Math.max(0.01, Math.min(0.99, v));
  $("sensitivity").value = Math.round(state.sensitivity * 100);
  $("sensValue").textContent = Math.round(state.sensitivity * 100) + "%";
}

/* -------------------------------------------------------------------- */
/* Verkabelung                                                          */
/* -------------------------------------------------------------------- */
function init() {
  $("toggleBtn").addEventListener("click", () => (state.running ? stop() : start()));
  $("resetBtn").addEventListener("click", resetAll);
  $("tapPad").addEventListener("click", () => { if (state.running) registerHit(); else showToast("Erst Start drücken"); });

  // Einstellungs-Sheet
  const openSheet = () => { $("settingsSheet").hidden = false; $("sheetBackdrop").hidden = false; };
  const closeSheet = () => { $("settingsSheet").hidden = true; $("sheetBackdrop").hidden = true; };
  window.__openRallySettings = openSheet;   // vom ⚙-Button (score.js) aufgerufen
  window.__rallyStop = stop;                 // beim Tab-Wechsel: Kamera/Mikro freigeben
  $("closeSheet").addEventListener("click", closeSheet);
  $("sheetBackdrop").addEventListener("click", closeSheet);

  document.querySelectorAll("#modeSelect button").forEach((b) =>
    b.addEventListener("click", () => setMode(b.dataset.mode))
  );

  $("sensitivity").addEventListener("input", (e) => setSensitivity(e.target.value / 100));
  $("calibrateBtn").addEventListener("click", () => audio.calibrate());

  $("rallyTimeout").addEventListener("input", (e) => {
    state.rallyTimeoutMs = +e.target.value;
    $("timeoutValue").textContent = (state.rallyTimeoutMs / 1000).toFixed(1).replace(".", ",") + " s";
  });
  $("vibrateToggle").addEventListener("change", (e) => (state.vibrate = e.target.checked));

  setMode("manual");
  setSensitivity(0.5);
  render();
  housekeeping();
}

document.addEventListener("DOMContentLoaded", init);
