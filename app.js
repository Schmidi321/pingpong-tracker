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
  sensitivity: 0.75,
  vibrate: true,
  facing: "environment",
  audioLeadInIgnored: false,
  milestonesShown: new Set(),
  challengeEnabled: true,
  challengeDurationSec: 120,
  challengeTimeLeft: 0,
  challengeTimer: null,
  challengeTotalHits: 0,
  countdownTimer: null,
};

/* -------------------------------------------------------------------- */
/* Zähl-Kern                                                            */
/* -------------------------------------------------------------------- */
function registerHit(source) {
  const now = performance.now();
  // Bei zu langer Pause zuerst den alten Ballwechsel abschließen.
  if (state.current > 0 && now - state.lastHit > state.rallyTimeoutMs) endRally();
  if (source === "audio" && state.current === 0 && state.audioLeadInIgnored && now - state.lastHit > state.rallyTimeoutMs) {
    state.audioLeadInIgnored = false;
  }
  if (source === "audio" && state.current === 0 && !state.audioLeadInIgnored) {
    state.audioLeadInIgnored = true;
    state.lastHit = now;
    return;
  }
  state.current += 1;
  if (state.challengeTimer) state.challengeTotalHits++;
  state.lastHit = now;
  if (state.current > state.longest) state.longest = state.current;
  if (state.vibrate && navigator.vibrate) navigator.vibrate(18);
  render();
  pulse();
  checkMilestone();
}

function endRally() {
  if (state.current <= 0) return;
  state.last = state.current;
  state.rallies += 1;
  const wasRecord = state.current === state.longest && state.current > 1;
  state.current = 0;
  state.audioLeadInIgnored = false;
  state.milestonesShown.clear();
  render();
  if (wasRecord) showToast("🏆 Neuer Rekord: " + state.last + " Schläge");
  else if (state.last > 1) showToast("Ballwechsel: " + state.last + " Schläge");
}

function resetAll() {
  state.current = state.longest = state.last = state.rallies = 0;
  state.audioLeadInIgnored = false;
  state.lastHit = 0;
  state.milestonesShown.clear();
  render();
  showToast("Zurückgesetzt");
}

/* ==================================================================== */
/* CHALLENGE-MODUS                                                       */
/* ==================================================================== */
function playBeep(freq, dur, vol) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq || 880;
    gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.12));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (dur || 0.12) + 0.05);
  } catch (e) {}
}

function speakNumber(n) {
  if (!window.speechSynthesis) return;
  // Während Sprachausgabe den Audio-Detektor stumm schalten
  if (state.mode === "audio") {
    audio.muted = true;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(String(n));
    utt.lang = "de-DE"; utt.rate = 1.0;
    utt.onend = utt.onerror = () => { setTimeout(() => { audio.muted = false; }, 600); };
    window.speechSynthesis.speak(utt);
    setTimeout(() => { audio.muted = false; }, 4000); // Fallback
  } else {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(String(n));
    utt.lang = "de-DE"; utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  }
}

function runCountdown(callback) {
  const overlay = $("countdownOverlay");
  const numEl   = $("countdownNumber");
  let n = 3;

  function showN(val) {
    numEl.textContent = val;
    numEl.classList.remove("pop");
    void numEl.offsetWidth;
    numEl.classList.add("pop");
  }

  overlay.hidden = false;
  showN(3);
  playBeep(523, 0.12, 0.4);

  state.countdownTimer = setInterval(() => {
    n--;
    if (n > 0) {
      showN(n);
      playBeep(523, 0.12, 0.4);
    } else {
      showN("GO!");
      playBeep(880, 0.22, 0.5);
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      setTimeout(() => { overlay.hidden = true; callback(); }, 650);
    }
  }, 1000);
}

function updatePaceDisplay() {
  const el = $("challengePace");
  if (!el) return;
  const elapsed = state.challengeDurationSec - state.challengeTimeLeft;
  if (elapsed < 3 || state.challengeTotalHits === 0) { el.textContent = ""; el.className = "challenge-pace"; return; }
  const projected = Math.round((state.challengeTotalHits / elapsed) * state.challengeDurationSec);
  const best = challengeBest();
  let cls, label;
  if (best > 0 && projected > best) {
    cls = "challenge-pace on-record";    label = "🏆 Kurs: " + projected + " Schläge";
  } else if (best > 0 && projected < best) {
    cls = "challenge-pace below-record"; label = "⬆ Kurs: " + projected + " Schläge";
  } else {
    cls = "challenge-pace pace-good";    label = "⬆ Kurs: " + projected + " Schläge";
  }
  el.textContent = label;
  el.className = cls;
}

function challengeFmt(sec) {
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
function challengeBestKey() { return "pp_chal_" + state.challengeDurationSec; }
function challengeBest()    { return parseInt(localStorage.getItem(challengeBestKey()) || "0"); }

function updateChallengeDisplay() {
  const pick      = $("challengePick");
  const countdown = $("challengeCountdown");
  const camTimer  = $("camTimer");
  const running   = state.challengeTimer !== null;

  if (!state.challengeEnabled || !running) {
    pick.hidden     = !state.challengeEnabled;
    countdown.hidden = true;
    if (camTimer) camTimer.hidden = true;
    return;
  }
  const fmt = challengeFmt(state.challengeTimeLeft);
  $("challengeTimeDisplay").textContent = fmt;
  const pct = (state.challengeTimeLeft / state.challengeDurationSec) * 100;
  const fill = $("challengePfill");
  fill.style.width = pct + "%";
  const warn = state.challengeTimeLeft <= 30;
  fill.classList.toggle("warn", warn);
  $("challengeTimeDisplay").classList.toggle("warn", warn);

  if (state.mode === "visual") {
    pick.hidden = true; countdown.hidden = true;
    if (camTimer) { camTimer.textContent = fmt; camTimer.hidden = false; }
  } else {
    pick.hidden = true; countdown.hidden = false;
    if (camTimer) camTimer.hidden = true;
  }
}

function tickChallenge() {
  state.challengeTimeLeft = Math.max(0, state.challengeTimeLeft - 1);
  updateChallengeDisplay();
  updatePaceDisplay();
  if (state.challengeTimeLeft > 0 && state.challengeTimeLeft <= 5)
    playBeep(state.challengeTimeLeft === 1 ? 1047 : 659, 0.14, 0.4);
  if (state.challengeTimeLeft > 0) return;
  clearInterval(state.challengeTimer);
  state.challengeTimer = null;
  endRally();
  const total = state.challengeTotalHits;
  const best  = challengeBest();
  const isRec = total > 0 && total > best;
  if (isRec) localStorage.setItem(challengeBestKey(), total);
  stop();
  showChallengeResult(total, state.longest, state.rallies, isRec, best);
  updateChallengeDisplay();
}

function showChallengeResult(total, bestRally, rallies, isRec, prevBest) {
  $("crTotal").textContent   = total;
  $("crBest").textContent    = bestRally;
  $("crRallies").textContent = rallies;
  $("crRecord").hidden       = !isRec;
  $("crEmoji").textContent   = isRec ? "🏆" : "⏱";
  $("crBestEver").textContent = (!isRec && prevBest > 0) ? "Rekord: " + prevBest + " Schläge" : "";
  $("challengeResult").hidden = false;
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
  $("counterCard").dataset.digits = String(state.current).length;
  if (window._ppTV) window._ppTV.postMessage({ current: state.current, longest: state.longest, last: state.last, rallies: state.rallies });
}


function checkMilestone() {
  if (state.current < 25 || state.current % 25 !== 0 || state.milestonesShown.has(state.current)) return;
  state.milestonesShown.add(state.current);
  showMilestone(state.current);
  if (state.current % 100 === 0 && state.current >= 100 && state.current <= 1000) speakNumber(state.current);
  else playBeep(state.current % 50 === 0 ? 880 : 659, 0.14, 0.3);
}

function milestoneCopy(value) {
  const messages = [
    { at: 25, kicker: "Warmgelaufen", sub: "25 am Stueck - sauberer Rhythmus!" },
    { at: 50, kicker: "Maschine", sub: "50 Treffer - das laeuft rund!" },
    { at: 75, kicker: "Fokus-Level", sub: "75 Schlaege - Nerven behalten!" },
    { at: 100, kicker: "Century Rally", sub: "100! Extra-Applaus fuer euch." },
  ];
  const exact = messages.find((m) => m.at === value);
  if (exact) return exact;
  return { kicker: "Weiter so", sub: value + " Schlaege - naechste Marke wartet!" };
}

function showMilestone(value) {
  const el = $("milestoneOverlay");
  if (!el) return;
  const finale = value >= 100;
  const copy = milestoneCopy(value);
  if (window.__ppSound && typeof window.__ppSound.milestone === "function") window.__ppSound.milestone(value);
  el.innerHTML = `
    <div class="milestone-card ${finale ? "finale" : ""}">
      <div class="milestone-kicker">${copy.kicker}</div>
      <div class="milestone-number">${value}</div>
      <div class="milestone-sub">${copy.sub}</div>
    </div>
  `;
  for (let i = 0; i < 28; i++) {
    const bit = document.createElement("i");
    bit.style.setProperty("--x", (Math.random() * 220 - 110).toFixed(0) + "px");
    bit.style.setProperty("--r", (Math.random() * 260 - 130).toFixed(0) + "deg");
    bit.style.setProperty("--d", (Math.random() * 0.18).toFixed(2) + "s");
    el.appendChild(bit);
  }
  el.hidden = false;
  el.classList.remove("show", "finale");
  void el.offsetWidth;
  el.classList.add("show");
  el.classList.toggle("finale", finale);
  if (state.vibrate && navigator.vibrate) navigator.vibrate(finale ? [35, 40, 80] : [25, 30, 25]);
  setTimeout(() => {
    el.classList.remove("show", "finale");
    setTimeout(() => { el.hidden = true; el.innerHTML = ""; }, 260);
  }, finale ? 2600 : 1900);
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
  armed: true, noiseFloor: 0.02, raf: 0, muted: false,

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
    // gleitender Grundpegel (nur in leisen Phasen nachführen)
    if (peak < this.noiseFloor + 0.02) this.noiseFloor = this.noiseFloor * 0.97 + peak * 0.03;

    // Schwelle dicht über dem Grundpegel; Empfindlichkeit steuert die Marge
    // (sens 0 → +0.15 unempfindlich … sens 1 → +0.008 sehr empfindlich)
    const threshold = this.noiseFloor + (0.15 - state.sensitivity * 0.142);
    // Anzeige verstärkt (Gain), damit auch leise Ball-Pegel sichtbar werden
    const GAIN = 300;
    $("audioMeter").style.width = Math.min(100, peak * GAIN) + "%";
    $("thresholdMarker").style.left = Math.min(100, threshold * GAIN) + "%";

    // Hysterese gegen Mehrfachzählung eines Schlags
    if (!this.muted && this.armed && peak >= threshold) {
      this.armed = false;
      registerHit("audio");
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
  zones: Array.from({length: 3}, () => new Array(4).fill(true)),

  async start() {
    const video = $("video");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return failMedia("Kamera", new Error("getUserMedia fehlt"));

    const attempts = [
      { video: { facingMode: { ideal: state.facing }, frameRate: { ideal: 30 }, width: { ideal: 1280 } }, audio: false },
      { video: { facingMode: { ideal: state.facing } }, audio: false },
      { video: true, audio: false },
    ];
    let lastError = null;
    for (const constraints of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!this.stream) return failMedia("Kamera", lastError);

    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.srcObject = this.stream;
    await new Promise((resolve) => {
      if (video.readyState >= 1) resolve();
      else {
        video.onloadedmetadata = resolve;
        setTimeout(resolve, 800);
      }
    });
    try { await video.play(); } catch (e) { return failMedia("Kamera", e); }

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
          const col = ((i % this.W) * 4 / this.W) | 0;
          const row = (((i / this.W) | 0) * 3 / this.H) | 0;
          if (!this.zones[row][col]) continue;
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
    const vi = $("videoInner"); if (vi) vi.style.transform = "";
    const zs = $("zoomSlider"); if (zs) zs.value = 1;
    const zv = $("zoomValue"); if (zv) zv.textContent = "1×";
    this.stream = this.prev = null;
  },
};

/* ==================================================================== */
/* BLUETOOTH-KOPFHÖRER (Media Session API)                              */
/* ==================================================================== */
const headphone = {
  enabled: false, _audio: null,

  enable() {
    this.enabled = true;
    try {
      const wav = new Uint8Array([82,73,70,70,37,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,64,31,0,0,1,0,8,0,100,97,116,97,1,0,0,0,128]);
      this._audio = new Audio(URL.createObjectURL(new Blob([wav], {type:'audio/wav'})));
      this._audio.loop = true; this._audio.volume = 0;
      this._audio.play().catch(() => {});
    } catch(e) {}
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Ping Pong Counter' });
      const hit = () => { if (state.running) registerHit('headphone'); };
      navigator.mediaSession.setActionHandler('play', hit);
      navigator.mediaSession.setActionHandler('pause', hit);
      navigator.mediaSession.setActionHandler('nexttrack', hit);
    }
    showToast('🎧 Kopfhörer-Taste aktiv');
  },

  disable() {
    this.enabled = false;
    if (this._audio) { URL.revokeObjectURL(this._audio.src); this._audio.pause(); this._audio = null; }
    if ('mediaSession' in navigator) {
      ['play','pause','nexttrack'].forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch(e) {} });
    }
  },
};

function initZoneGrid() {
  const grid = $('zoneGrid');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const cell = document.createElement('div');
    cell.className = 'zone-cell';
    cell.addEventListener('pointerdown', () => {
      visual.zones[r][c] = !visual.zones[r][c];
      cell.classList.toggle('off', !visual.zones[r][c]);
    });
    grid.appendChild(cell);
  }
}

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
  btn.textContent = "Stopp";
  btn.classList.add("running");
  if (state.challengeEnabled) {
    state.current = state.longest = state.last = state.rallies = 0;
    state.audioLeadInIgnored = false;
    state.lastHit = 0;
    state.milestonesShown.clear();
    state.challengeTotalHits = 0;
    state.challengeTimeLeft = state.challengeDurationSec;
    render();
    runCountdown(() => {
      state.challengeTimer = setInterval(tickChallenge, 1000);
      updateChallengeDisplay();
      showToast("⏱ Challenge läuft!");
    });
  } else {
    if (state.mode === "manual") showToast("Los geht's – tippen!");
  }
}

function stop() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer); state.countdownTimer = null;
    $("countdownOverlay").hidden = true;
  }
  if (state.challengeTimer) { clearInterval(state.challengeTimer); state.challengeTimer = null; }
  audio.stop(); visual.stop();
  state.running = false;
  endRally();
  const btn = $("toggleBtn");
  btn.textContent = state.mode === "visual" ? "Kamera starten" : "Start";
  btn.classList.remove("running");
  updateChallengeDisplay();
}

function setMode(mode) {
  if (state.running) stop();
  state.mode = mode;
  const appEl = document.querySelector(".app");
  if (appEl) appEl.dataset.rallyMode = mode;
  ["visual", "audio", "manual"].forEach((m) => ($("panel-" + m).hidden = m !== mode));
  document.querySelectorAll("#modeSelect button").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );
  // Empfindlichkeits-Zeile nur für audio/visual zeigen
  document.querySelectorAll("[data-for]").forEach((el) => {
    const list = el.dataset.for.split(" ");
    el.hidden = !list.includes(mode);
  });
  const sensitivityLabel = $("sensitivityLabel");
  if (sensitivityLabel) sensitivityLabel.textContent = mode === "audio" ? "Ton-Empfindlichkeit" : "Kamera-Empfindlichkeit";
  if (!state.running) $("toggleBtn").textContent = mode === "visual" ? "Kamera starten" : "Start";
}

function setSensitivity(v) {
  state.sensitivity = Math.max(0.01, Math.min(0.99, v));
  $("sensitivity").value = Math.round(state.sensitivity * 100);
  $("sensValue").textContent = Math.round(state.sensitivity * 100) + "%";
}

/* Kamera vorne/hinten umschalten – damit man bei Tisch-Aufstellung den
   Bildschirm sehen kann. Bei laufender Kamera den Stream neu holen. */
async function flipCamera() {
  state.facing = state.facing === "environment" ? "user" : "environment";
  $("video").classList.toggle("mirror", state.facing === "user");
  showToast(state.facing === "user" ? "Frontkamera (vorne)" : "Rückkamera (hinten)");
  if (state.mode === "visual" && state.running) {
    visual.stop();
    await visual.start();
  }
}

/* -------------------------------------------------------------------- */
/* Verkabelung                                                          */
/* -------------------------------------------------------------------- */
function init() {
  $("toggleBtn").addEventListener("click", () => (state.running ? stop() : start()));
  $("resetBtn").addEventListener("click", resetAll);
  $("tapPad").addEventListener("click", () => { if (state.running) registerHit(); else showToast("Erst Start drücken"); });

  // Einstellungs-Sheet
  const openSheet = () => {
    if (typeof window.__syncScoreSettings === "function") window.__syncScoreSettings();
    $("settingsSheet").hidden = false; $("sheetBackdrop").hidden = false;
  };
  const closeSheet = () => { $("settingsSheet").hidden = true; $("sheetBackdrop").hidden = true; };
  window.__openRallySettings = openSheet;   // vom ⚙-Button (score.js) aufgerufen
  window.__rallyMode = () => state.mode;
  window.__rallyStop = stop;                 // beim Tab-Wechsel: Kamera/Mikro freigeben
  $("closeSheet").addEventListener("click", closeSheet);
  $("sheetBackdrop").addEventListener("click", closeSheet);

  document.querySelectorAll("#modeSelect button").forEach((b) =>
    b.addEventListener("click", () => {
      setMode(b.dataset.mode);
      if (typeof window.__showHelp === "function") window.__showHelp("rally");
    })
  );

  $("sensitivity").addEventListener("input", (e) => setSensitivity(e.target.value / 100));
  $("calibrateBtn").addEventListener("click", () => audio.calibrate());
  $("flipCam").addEventListener("click", flipCamera);
  $("zoomSlider").addEventListener("input", (e) => {
    const z = parseFloat(e.target.value);
    $("zoomValue").textContent = z.toFixed(1).replace(".", ",") + "×";
    const vi = $("videoInner"); if (vi) vi.style.transform = z > 1 ? `scale(${z})` : "";
  });

  $("rallyTimeout").addEventListener("input", (e) => {
    state.rallyTimeoutMs = +e.target.value;
    $("timeoutValue").textContent = (state.rallyTimeoutMs / 1000).toFixed(1).replace(".", ",") + " s";
  });
  $("vibrateToggle").addEventListener("change", (e) => (state.vibrate = e.target.checked));

  // Challenge-Zeit wählen
  document.querySelectorAll("#challengeTimeSel button").forEach((b) =>
    b.addEventListener("click", () => {
      if (state.challengeTimer) return;
      state.challengeDurationSec = parseInt(b.dataset.min) * 60;
      state.challengeEnabled = true;
      document.querySelectorAll("#challengeTimeSel button").forEach((x) =>
        x.classList.toggle("active", x === b)
      );
      updateChallengeDisplay();
    })
  );
  $("challengeResultOk").addEventListener("click", () => {
    $("challengeResult").hidden = true;
    start();
  });
  $("challengeResultClose").addEventListener("click", () => {
    $("challengeResult").hidden = true;
    updateChallengeDisplay();
  });

  // Erkennungszonen
  initZoneGrid();
  $('zonesBtn').addEventListener('click', () => {
    const g = $('zoneGrid');
    const show = g.style.display !== 'grid';
    g.style.display = show ? 'grid' : 'none';
    $('zonesBtn').classList.toggle('active', show);
    if (show) showToast('Tippen zum Sperren · nochmal tippen zum Aktivieren');
  });

  // TV-Ansicht
  $('tvBtn').addEventListener('click', () => {
    if (!('BroadcastChannel' in window)) { showToast('Nicht unterstützt'); return; }
    if (!window._ppTV) window._ppTV = new BroadcastChannel('pp-counter');
    window.open('tv.html', 'ppTV', 'width=1280,height=720,noreferrer');
    showToast('📺 TV-Fenster geöffnet');
  });

  // Kopfhörer
  $('headphoneToggle').addEventListener('change', (e) => {
    e.target.checked ? headphone.enable() : headphone.disable();
  });

  setMode("visual");
  setSensitivity(0.75);
  render();
  housekeeping();
}

document.addEventListener("DOMContentLoaded", init);
