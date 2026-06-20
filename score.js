"use strict";

/* ====================================================================
   Tischtennis-Punktezähler (manueller Modus)
   - zwei Tap-Felder (Spieler 1 / Spieler 2), Tippen = Punkt
   - Regeln: bis 11 (oder 21), 2 Punkte Vorsprung
   - Aufschlagwechsel alle 2 Punkte, bei Deuce (10:10) jeder Punkt
   - Sätze als Best-of (3/5/7), Seitenwechsel je Satz
   - Satz-/Matchball-Anzeige, Undo, Vibration
   Eigener Namespace; nutzt nur showToast()/__rallyStop()/__openRallySettings() aus app.js.
   ==================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const other = (p) => (p === 1 ? 2 : 1);
  const sfx = (p) => (p === 1 ? "P1" : "P2");

  const S = {
    names: { 1: "Spieler 1", 2: "Spieler 2" },
    points: { 1: 0, 2: 0 },
    sets: { 1: 0, 2: 0 },
    ppg: 11,
    bestOf: 5,
    matchFirstServer: 1,
    vibrate: true,
    layout: "auto",          // "auto" | "portrait" | "landscape"
    inputMode: "tap",        // "tap" | "voice" | "auto"
    keepAwake: true,
    matchOver: false,
    history: [],
  };

  const setsToWin = () => Math.floor(S.bestOf / 2) + 1;
  const gamesPlayed = () => S.sets[1] + S.sets[2];
  const firstServerThisGame = () =>
    gamesPlayed() % 2 === 0 ? S.matchFirstServer : other(S.matchFirstServer);

  /* aktueller Aufschläger aus dem Spielstand abgeleitet */
  function currentServer() {
    const ppg = S.ppg, a = S.points[1], b = S.points[2];
    const fs = firstServerThisGame();
    const total = a + b;
    const deuce = a >= ppg - 1 && b >= ppg - 1;
    let switches;
    if (!deuce) {
      switches = Math.floor(total / 2);
    } else {
      const pre = 2 * (ppg - 1);
      switches = Math.floor(pre / 2) + (total - pre); // ab Deuce jeder Punkt
    }
    return switches % 2 === 0 ? fs : other(fs);
  }

  const toast = (m) => { if (typeof showToast === "function") showToast(m); };
  const buzz = (ms) => { if (S.vibrate && navigator.vibrate) navigator.vibrate(ms); };

  /* -------------------------------------------------------------- */
  function addPoint(p) {
    if (S.matchOver) return;
    S.history.push(JSON.stringify({ p: S.points, s: S.sets }));
    if (S.history.length > 300) S.history.shift();

    S.points[p]++;
    const o = other(p), ppg = S.ppg;

    if (S.points[p] >= ppg && S.points[p] - S.points[o] >= 2) {
      S.sets[p]++;                       // Satz gewonnen
      if (S.sets[p] >= setsToWin()) {
        S.matchOver = true;
        render(); winAnim(p); buzz(40); showWinner(p);
        return;
      }
      S.points[1] = 0; S.points[2] = 0;  // nächster Satz
      render(); winAnim(p); buzz(30);
      toast("Satz für " + S.names[p] + " · Seitenwechsel");
      return;
    }
    render(); buzz(14); pointPulse(p);
  }

  function undo() {
    if (!S.history.length) { toast("Nichts rückgängig zu machen"); return; }
    const snap = JSON.parse(S.history.pop());
    S.points = snap.p; S.sets = snap.s; S.matchOver = false;
    $("winner").hidden = true;
    render();
  }

  function newMatch() {
    S.points = { 1: 0, 2: 0 }; S.sets = { 1: 0, 2: 0 };
    S.matchOver = false; S.history = [];
    $("winner").hidden = true;
    render();
    if (typeof AutoRally !== "undefined" && AutoRally.active) AutoRally.beginRally();
  }

  /* -------------------------------------------------------------- */
  function render() {
    const server = S.matchOver ? 0 : currentServer();
    const need = setsToWin();

    for (const p of [1, 2]) {
      const o = other(p), s = sfx(p);
      $("score" + s).textContent = S.points[p];
      $("name" + s).textContent = S.names[p];
      $("serve" + s).classList.toggle("on", server === p);

      let pips = "";
      for (let i = 0; i < need; i++) pips += `<i class="${i < S.sets[p] ? "won" : ""}"></i>`;
      $("sets" + s).innerHTML = pips;

      const hint = $("hint" + s);
      const np = S.points[p] + 1;
      const wouldWinGame = np >= S.ppg && np - S.points[o] >= 2;
      hint.className = "ballhint";
      if (!S.matchOver && wouldWinGame) {
        const matchBall = S.sets[p] + 1 >= need;
        hint.textContent = matchBall ? "Matchball" : "Satzball";
        hint.classList.add("show", matchBall ? "match" : "set");
      } else {
        hint.textContent = "";
      }
    }

    $("setNum1").textContent = S.sets[1];
    $("setNum2").textContent = S.sets[2];
    $("serveLabel").textContent = server ? "Aufschlag " + S.names[server] : "Match beendet";
  }

  function winAnim(p) {
    const el = $("half" + sfx(p));
    el.classList.remove("win"); void el.offsetWidth; el.classList.add("win");
  }
  function pointPulse(p) {
    const el = $("score" + sfx(p));
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  }

  /* Konfetti beim Match-Gewinn (Canvas, räumt sich selbst auf) */
  const Confetti = {
    cv: null, ctx: null, parts: [], raf: 0, until: 0,
    burst(winner) {
      this.cv = this.cv || $("confetti");
      if (!this.cv) return;
      this.ctx = this.ctx || this.cv.getContext("2d");
      const W = (this.cv.width = window.innerWidth);
      const H = (this.cv.height = window.innerHeight);
      const cols = winner === 2
        ? ["#f97316", "#fdba74", "#ffffff", "#38bdf8"]
        : ["#38bdf8", "#7dd3fc", "#ffffff", "#f97316"];
      this.parts = [];
      for (let i = 0; i < 150; i++) {
        this.parts.push({
          x: W * (0.2 + Math.random() * 0.6), y: H * 0.28 + (Math.random() - 0.5) * 80,
          vx: (Math.random() - 0.5) * 10, vy: Math.random() * -10 - 3,
          g: 0.16 + Math.random() * 0.12, s: 5 + Math.random() * 8,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
          c: cols[i % cols.length],
        });
      }
      this.until = performance.now() + 2800;
      cancelAnimationFrame(this.raf); this.loop();
    },
    loop() {
      const ctx = this.ctx, cv = this.cv;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of this.parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.55);
        ctx.restore();
      }
      if (performance.now() < this.until) this.raf = requestAnimationFrame(() => this.loop());
      else ctx.clearRect(0, 0, cv.width, cv.height);
    },
  };

  function showWinner(p) {
    $("winnerName").textContent = S.names[p];
    $("winnerSub").textContent = `gewinnt ${S.sets[p]} : ${S.sets[other(p)]}`;
    const w = $("winner");
    w.dataset.p = p;
    w.hidden = false;
    Confetti.burst(p);
  }

  /* ----------------------------- Config ------------------------- */
  function saveCfg() {
    try {
      localStorage.setItem("tt.cfg", JSON.stringify({
        names: S.names, ppg: S.ppg, bestOf: S.bestOf, mfs: S.matchFirstServer, vib: S.vibrate, lay: S.layout, inp: S.inputMode, wake: S.keepAwake,
      }));
    } catch (e) {}
  }
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem("tt.cfg") || "null");
      if (!c) return;
      if (c.names) S.names = c.names;
      S.ppg = c.ppg || 11; S.bestOf = c.bestOf || 5;
      S.matchFirstServer = c.mfs || 1; S.vibrate = c.vib !== false; S.layout = c.lay || "auto"; S.inputMode = c.inp || "tap"; S.keepAwake = c.wake !== false;
    } catch (e) {}
  }
  function pickSegment(container, value, attr) {
    container.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b.dataset[attr] === String(value)));
  }
  function syncSettingsUI() {
    $("inName1").value = S.names[1] === "Spieler 1" ? "" : S.names[1];
    $("inName2").value = S.names[2] === "Spieler 2" ? "" : S.names[2];
    pickSegment($("bestOfSel"), S.bestOf, "bo");
    pickSegment($("ppgSel"), S.ppg, "pp");
    pickSegment($("firstServeSel"), S.matchFirstServer, "fs");
    pickSegment($("layoutSel"), S.layout, "lay");
    pickSegment($("inputSel"), S.inputMode, "inp");
    $("scoreVibrate").checked = S.vibrate;
    $("wakeToggle").checked = S.keepAwake;
  }

  /* --------------------------- Sheet/Tabs ----------------------- */
  let activeView = "score";
  const openScoreSheet = () => { syncSettingsUI(); $("scoreSheet").hidden = false; $("sheetBackdrop").hidden = false; };
  const closeScoreSheet = () => { $("scoreSheet").hidden = true; $("sheetBackdrop").hidden = true; };

  const VIEW_ORDER = { score: 0, rally: 1 };
  function switchView(v) {
    const dir = (VIEW_ORDER[v] >= VIEW_ORDER[activeView]) ? "anim-r" : "anim-l";
    activeView = v;
    $("view-score").hidden = v !== "score";
    $("view-rally").hidden = v !== "rally";
    const el = $("view-" + v);
    el.classList.remove("anim-r", "anim-l"); void el.offsetWidth; el.classList.add(dir);
    document.querySelectorAll("#tabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === v));
    if (v !== "rally" && typeof window.__rallyStop === "function") window.__rallyStop();
    if (v !== "score") { Voice.stop(true); AutoRally.stop(); }   // Mikro-Features nur im Punkte-Tab
    updateVoiceBtn();
  }

  /* ----------------------- Sprachsteuerung ---------------------- */
  /* "eins"/"1" → Punkt für Spieler 1, "zwei"/"2" → Spieler 2.
     Web Speech API (Chrome/Edge/Android), braucht Mikrofon + HTTPS. */
  const ONES = ["1", "eins", "ein", "eis", "einz", "ans", "heins", "reins"];
  const TWOS = ["2", "zwei", "zwo", "zwai", "zwein", "zweit", "swei", "schwei"];
  function parsePlayer(txt) {
    let p = 0;
    for (const t of txt.toLowerCase().replace(/[.,!?]/g, " ").split(/\s+/)) {
      if (ONES.includes(t)) p = 1;
      else if (TWOS.includes(t)) p = 2;
    }
    return p; // die zuletzt genannte Zahl gewinnt
  }

  const Voice = {
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    rec: null, active: false, consumedIdx: -1,

    start() {
      if (!this.supported) { toast("Sprachsteuerung wird hier nicht unterstützt"); return; }
      if (AutoRally.active) AutoRally.stop();              // Mikro nicht doppelt belegen
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "de-DE";
      rec.continuous = true;
      rec.interimResults = true;             // sofort reagieren (Zwischenergebnisse)
      rec.maxAlternatives = 4;               // mehr Kandidaten → „eins/zwei“ öfter erkannt
      rec.onstart = () => { this.consumedIdx = -1; };
      rec.onresult = (e) => {
        const i = e.results.length - 1;      // jüngste Äußerung
        const r = e.results[i];
        let p = 0;
        for (let a = 0; a < r.length; a++) { p = parsePlayer(r[a].transcript); if (p) break; }
        if (!p || i === this.consumedIdx) return;   // pro Äußerung genau einmal werten
        this.consumedIdx = i;
        if (S.matchOver) { toast("Match ist beendet"); return; }
        addPoint(p);
        winAnim(p);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          toast("Mikrofon-Zugriff nötig"); this.stop(true);
        }
      };
      rec.onend = () => { if (this.active) { try { rec.start(); } catch (_) {} } };
      this.rec = rec; this.active = true;
      try { rec.start(); } catch (_) {}
      setVoiceUI(true);
      toast("🎤 Sprache an – sag „eins“ oder „zwei“");
    },

    stop(silent) {
      this.active = false;
      if (this.rec) { try { this.rec.stop(); } catch (_) {} this.rec = null; }
      setVoiceUI(false);
      if (!silent) toast("🎤 Sprache aus");
    },

    toggle() { this.active ? this.stop() : this.start(); },
  };

  /* Das Banner ist Status UND Start/Stopp für Sprache/Ton (kein Topbar-Knopf mehr). */
  function setVoiceUI() { updateMicBanner(); }
  function updateVoiceBtn() { updateMicBanner(); }   // Alias für Altaufrufer
  function updateMicBanner() {
    const el = $("autoBanner"); if (!el) return;
    if (activeView !== "score" || S.inputMode === "tap") { el.hidden = true; el.classList.remove("pending"); return; }
    if (S.inputMode === "auto" && AutoRally.active) return;   // AutoRally steuert das Banner selbst
    el.hidden = false; el.classList.remove("pending");
    el.textContent = S.inputMode === "voice"
      ? (Voice.active ? "🎤 Sprache aktiv · „eins/zwei“ sagen — tippen = Stopp" : "🎤 Sprache – tippen zum Starten")
      : "🎧 Auto-Rally – tippen zum Starten";
  }

  /* Querformat/Hochformat – "auto" folgt der Geräte-Ausrichtung, sonst erzwungen */
  function applyLayout() {
    const eff = S.layout === "auto"
      ? (window.innerWidth >= window.innerHeight ? "landscape" : "portrait")
      : S.layout;
    const app = document.querySelector(".app");
    if (app) app.dataset.eff = eff;
  }

  /* Bildschirm anlassen (Wake Lock API; iOS ab Safari 16.4). Wird bei Wieder-
     Sichtbarkeit neu angefordert, da das Lock beim Tab-Wechsel verfällt. */
  const Wake = {
    lock: null,
    async apply() {
      if (S.keepAwake && document.visibilityState === "visible" && "wakeLock" in navigator) {
        if (this.lock) return;
        try {
          this.lock = await navigator.wakeLock.request("screen");
          this.lock.addEventListener("release", () => { this.lock = null; });
        } catch (_) {}
      } else if (this.lock) {
        try { this.lock.release(); } catch (_) {}
        this.lock = null;
      }
    },
  };

  /* ====================== Auto-Rally (Ton, 2 Spieler) ======================
     Hört per Web Audio die Schläge eines Ballwechsels, erkennt das Rally-Ende
     (Pause nach Schlägen) und fragt den Gewinner ab: per Stimme ("eins/zwei")
     ODER Tippen der Spielerhälfte. Punkt landet im normalen Zähler.
     Die Ton-Erkennung ist – wie der Rally-Modus – am Tisch feinzutunen. */
  function setAutoUI() { updateVoiceBtn(); }   // -> gemeinsamer Modus-Knopf
  function hideAutoBanner() { const el = $("autoBanner"); if (el) { el.hidden = true; el.classList.remove("pending"); } }
  function showAutoBanner(mode, hits) {
    const el = $("autoBanner"); if (!el) return;
    el.hidden = false;
    el.classList.toggle("pending", mode === "pending");
    if (mode === "pending") el.textContent = `🏁 Punkt! (${hits} Schläge) – wer? „eins/zwei“ sagen oder tippen`;
    else if (mode === "done") el.textContent = "🏆 Match beendet";
    else el.textContent = hits > 0 ? `🎧 Ballwechsel läuft · ${hits} Schläge` : "🎧 Auto-Rally aktiv · spielt los";
  }

  const AutoRally = {
    active: false, state: "off",
    ctx: null, analyser: null, stream: null, buf: null, raf: 0,
    armed: true, noiseFloor: 0.02, hits: 0, lastHit: 0, endMs: 1800, rec: null,

    toggle() { this.active ? this.stop() : this.start(); },

    async start() {
      if (Voice.active) Voice.stop(true);                 // Mikro nicht doppelt belegen
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (e) { toast("Mikrofon-Zugriff nötig"); return; }
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.fftSize);
      this.active = true; this.armed = true;
      setAutoUI(true); updateVoiceBtn();
      this.beginRally();
      this.loop();
      toast("🎧 Auto-Rally an – einfach spielen");
    },

    beginRally() { this.state = "listening"; this.hits = 0; this.lastHit = 0; showAutoBanner("listening", 0); },

    loop() {
      if (!this.active) return;
      this.analyser.getByteTimeDomainData(this.buf);
      let peak = 0;
      for (let i = 0; i < this.buf.length; i++) { const v = Math.abs(this.buf[i] - 128) / 128; if (v > peak) peak = v; }
      if (peak < this.noiseFloor + 0.02) this.noiseFloor = this.noiseFloor * 0.97 + peak * 0.03;
      const threshold = this.noiseFloor + 0.04;   // dicht über Grundpegel = empfindlich
      const now = performance.now();
      if (this.state === "listening") {
        if (this.armed && peak >= threshold) {
          this.armed = false; this.hits++; this.lastHit = now;
          if (S.vibrate && navigator.vibrate) navigator.vibrate(6);
          showAutoBanner("listening", this.hits);
        } else if (!this.armed && peak < threshold * 0.55) {
          this.armed = true;
        }
        if (this.hits > 0 && now - this.lastHit > this.endMs) this.endRally();
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },

    endRally() {
      this.state = "pending";
      showAutoBanner("pending", this.hits);
      if (navigator.vibrate) navigator.vibrate(40);
      const sb = $("scoreboard"); if (sb) sb.classList.add("await-pick");
      this.listenWinner();
    },

    listenWinner() {
      if (!Voice.supported) return;   // ohne Spracherkennung: nur Tippen
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "de-DE"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 4;
      let consumed = -1;
      rec.onstart = () => { consumed = -1; };
      rec.onresult = (e) => {
        const i = e.results.length - 1;
        const r = e.results[i];
        let p = 0;
        for (let a = 0; a < r.length; a++) { p = parsePlayer(r[a].transcript); if (p) break; }
        if (p && i !== consumed) { consumed = i; this.assign(p); }
      };
      rec.onerror = () => {};
      rec.onend = () => { if (this.state === "pending" && this.active) { try { rec.start(); } catch (_) {} } };
      this.rec = rec; try { rec.start(); } catch (_) {}
    },

    stopWinnerListen() { if (this.rec) { try { this.rec.stop(); } catch (_) {} this.rec = null; } },

    assign(p) {                       // Gewinner per Stimme ODER Tipp
      if (!this.active) return;
      this.stopWinnerListen();
      const sb = $("scoreboard"); if (sb) sb.classList.remove("await-pick");
      addPoint(p); winAnim(p);
      if (S.matchOver) { this.state = "matchover"; showAutoBanner("done", 0); }
      else this.beginRally();
    },

    stop() {
      this.active = false; this.state = "off";
      cancelAnimationFrame(this.raf);
      this.stopWinnerListen();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.ctx) { try { this.ctx.close(); } catch (_) {} }
      this.ctx = this.analyser = this.stream = null;
      const sb = $("scoreboard"); if (sb) sb.classList.remove("await-pick");
      hideAutoBanner(); setAutoUI(false); updateVoiceBtn();
    },
  };

  /* ----------------------------- Init --------------------------- */
  function init() {
    loadCfg();

    $("halfP1").addEventListener("click", () => AutoRally.active ? AutoRally.assign(1) : addPoint(1));
    $("halfP2").addEventListener("click", () => AutoRally.active ? AutoRally.assign(2) : addPoint(2));
    $("undoBtn").addEventListener("click", undo);
    $("newMatchBtn").addEventListener("click", () => { newMatch(); toast("Neues Match"); });
    $("winnerNew").addEventListener("click", () => { newMatch(); toast("Neues Match"); });
    $("autoBanner").addEventListener("click", () => {
      if (S.inputMode === "voice") Voice.toggle();
      else if (S.inputMode === "auto") AutoRally.toggle();
    });
    updateMicBanner();

    document.querySelectorAll("#tabs button").forEach((b) =>
      b.addEventListener("click", () => switchView(b.dataset.view)));

    // ⚙ öffnet die Einstellungen der aktiven Ansicht
    $("settingsBtn").addEventListener("click", () => {
      if (activeView === "score") openScoreSheet();
      else if (typeof window.__openRallySettings === "function") window.__openRallySettings();
    });
    $("scoreSheetSave").addEventListener("click", () => {
      S.names[1] = $("inName1").value.trim() || "Spieler 1";
      S.names[2] = $("inName2").value.trim() || "Spieler 2";
      saveCfg(); closeScoreSheet(); newMatch(); toast("Neues Match");
    });
    $("sheetBackdrop").addEventListener("click", closeScoreSheet);

    $("bestOfSel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      S.bestOf = +b.dataset.bo; pickSegment($("bestOfSel"), S.bestOf, "bo"); saveCfg(); render();
    });
    $("ppgSel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      S.ppg = +b.dataset.pp; pickSegment($("ppgSel"), S.ppg, "pp"); saveCfg(); render();
    });
    $("firstServeSel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      S.matchFirstServer = +b.dataset.fs; pickSegment($("firstServeSel"), S.matchFirstServer, "fs"); saveCfg(); render();
    });
    $("scoreVibrate").addEventListener("change", (e) => { S.vibrate = e.target.checked; saveCfg(); });
    $("wakeToggle").addEventListener("change", (e) => { S.keepAwake = e.target.checked; saveCfg(); Wake.apply(); });
    $("layoutSel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      S.layout = b.dataset.lay; pickSegment($("layoutSel"), S.layout, "lay"); saveCfg(); applyLayout();
    });
    $("inputSel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      Voice.stop(true); AutoRally.stop();           // laufenden Modus beenden
      S.inputMode = b.dataset.inp; pickSegment($("inputSel"), S.inputMode, "inp"); saveCfg();
      if (S.inputMode === "voice") Voice.start();    // Auswahl-Tipp = Geste → Mikro darf starten
      else if (S.inputMode === "auto") AutoRally.start();
      updateMicBanner();
    });
    window.addEventListener("resize", applyLayout);
    window.addEventListener("orientationchange", applyLayout);
    applyLayout();
    document.addEventListener("visibilitychange", () => Wake.apply());
    Wake.apply();

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
