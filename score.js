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
    keepAwake: true,
    sound: true,
    showHelp: true,
    lastBallSoundKey: "",
    matchOver: false,
    history: [],
    sixseven: false,
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

  const Sound = (() => {
    let ctx = null;
    function audioCtx() {
      if (!S.sound) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = ctx || new AC();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(freq, start, dur, type, gainValue) {
      const ac = audioCtx();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, ac.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(gainValue || 0.12, ac.currentTime + start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(ac.currentTime + start);
      osc.stop(ac.currentTime + start + dur + 0.03);
    }
    function seq(notes, type, gain) { notes.forEach((n) => tone(n[0], n[1], n[2], type, gain)); }
    function speak(text) {
      if (!S.sound || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "de-DE";
        utterance.rate = 1.02;
        utterance.pitch = 1.05;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (_) {}
    }
    return {
      matchball() { seq([[392, 0, .10], [523, .12, .12], [659, .25, .16]], "triangle", .11); },
      win() { seq([[523, 0, .12], [659, .12, .12], [784, .24, .18], [1046, .43, .28]], "sine", .13); },
      milestone(value) {
        const finale = value >= 100;
        seq(finale
          ? [[392, 0, .10], [523, .11, .10], [659, .22, .12], [784, .36, .15], [1046, .55, .35], [784, .92, .18], [1046, 1.08, .28]]
          : [[440, 0, .10], [660, .13, .12], [880, .30, .18]], "triangle", finale ? .13 : .1);
        if (finale) speak("Die " + value + " ist erreicht, ihr Helden.");
      },
      sixseven() { seq([[440, 0, .10], [554, .12, .10], [659, .24, .12], [880, .38, .20], [1047, .58, .30]], 'sine', .13); },
      enabled() { return S.sound; },
    };
  })();
  window.__ppSound = Sound;

  /* -------------------------------------------------------------- */
  let sixsevenTimer = 0;
  function showSixSeven() {
    const el = $('sixsevenOverlay');
    if (!el) return;
    clearTimeout(sixsevenTimer);
    el.hidden = false;
    el.classList.remove('show', 'fade'); void el.offsetWidth;
    el.classList.add('show');
    Sound.sixseven();
    sixsevenTimer = setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => { el.hidden = true; el.classList.remove('show', 'fade'); }, 350);
    }, 2200);
  }

  /* -------------------------------------------------------------- */
  function addPoint(p) {
    if (S.matchOver) return;
    S.history.push(JSON.stringify({ p: S.points, s: S.sets }));
    if (S.history.length > 300) S.history.shift();

    S.points[p]++;
    const o = other(p), ppg = S.ppg;

    if (S.sixseven) {
      const a = S.points[1], b = S.points[2];
      if ((a === 6 && b === 7) || (a === 7 && b === 6)) showSixSeven();
    }

    if (S.points[p] >= ppg && S.points[p] - S.points[o] >= 2) {
      S.sets[p]++;                       // Satz gewonnen
      if (S.sets[p] >= setsToWin()) {
        S.matchOver = true;
        render(); winAnim(p); buzz(40); Sound.win(); showWinner(p);
        return;
      }
      S.points[1] = 0; S.points[2] = 0;  // nächster Satz
      render(); winAnim(p); buzz(30);
      toast("Satz für " + S.names[p] + " · Seitenwechsel");
      return;
    }
    render(); buzz(14); pointPulse(p); playBallCue();
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
    S.matchOver = false; S.history = []; S.lastBallSoundKey = "";
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
        names: S.names, ppg: S.ppg, bestOf: S.bestOf, mfs: S.matchFirstServer, vib: S.vibrate, lay: S.layout, wake: S.keepAwake, snd: S.sound, help: S.showHelp, six: S.sixseven,
      }));
    } catch (e) {}
  }
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem("tt.cfg") || "null");
      if (!c) return;
      if (c.names) S.names = c.names;
      S.ppg = c.ppg || 11; S.bestOf = c.bestOf || 5;
      S.matchFirstServer = c.mfs || 1; S.vibrate = c.vib !== false; S.layout = c.lay || "auto"; S.keepAwake = c.wake !== false;
      S.sound = c.snd !== false; S.showHelp = c.help !== false; S.sixseven = c.six === true;
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
    $("scoreVibrate").checked = S.vibrate;
    $("wakeToggle").checked = S.keepAwake;
    const sixTog = $("sixsevenToggle"); if (sixTog) sixTog.checked = S.sixseven;
    syncGlobalToggles();
  }
  function syncGlobalToggles() {
    ["soundToggle", "rallySoundToggle"].forEach((id) => { const el = $(id); if (el) el.checked = S.sound; });
    ["helpToggle", "rallyHelpToggle"].forEach((id) => { const el = $(id); if (el) el.checked = S.showHelp; });
  }
  function playBallCue() {
    const need = setsToWin();
    let key = "";
    for (const p of [1, 2]) {
      const o = other(p);
      const wouldWinGame = S.points[p] + 1 >= S.ppg && S.points[p] + 1 - S.points[o] >= 2;
      if (wouldWinGame && S.sets[p] + 1 >= need) key = `${p}:${S.points[1]}:${S.points[2]}:${S.sets[1]}:${S.sets[2]}`;
    }
    if (key && key !== S.lastBallSoundKey) { S.lastBallSoundKey = key; Sound.matchball(); }
    if (!key) S.lastBallSoundKey = "";
  }

  /* --------------------------- Sheet/Tabs ----------------------- */
  let activeView = "score";
  let showHelp = () => {};
  const openScoreSheet = () => { syncSettingsUI(); $("scoreSheet").hidden = false; $("sheetBackdrop").hidden = false; };
  const closeScoreSheet = () => { $("scoreSheet").hidden = true; $("sheetBackdrop").hidden = true; };
  window.__syncScoreSettings = syncGlobalToggles;

  const VIEW_ORDER = { score: 0, rally: 1 };
  function switchView(v) {
    const dir = (VIEW_ORDER[v] >= VIEW_ORDER[activeView]) ? "anim-r" : "anim-l";
    activeView = v;
    const app = document.querySelector(".app");
    if (app) app.dataset.view = v;
    $("view-score").hidden = v !== "score";
    $("view-rally").hidden = v !== "rally";
    const el = $("view-" + v);
    el.classList.remove("anim-r", "anim-l"); void el.offsetWidth; el.classList.add(dir);
    document.querySelectorAll("#tabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === v));
    if (v !== "rally" && typeof window.__rallyStop === "function") window.__rallyStop();
    if (v !== "score") { Voice.stop(true); AutoRally.stop(); }   // Mikro-Features nur im Punkte-Tab
    updateVoiceBtn();
    if (v === "score") showHelp("score");
    if (v === "rally") showHelp("rally");
  }

  /* ----------------------- Klatsch-Steuerung ---------------------- */
  /* 1x klatschen -> Punkt fuer Spieler 1, 2x klatschen (kurz hintereinander)
     -> Punkt fuer Spieler 2. Laeuft komplett lokal ueber die Mikro-Lautstaerke
     (Web Audio), bewusst OHNE SpeechRecognition: die Android-Systemerkennung
     spielt bei jedem Start/Neustart einen nicht abschaltbaren System-Piepton -
     bei Dauerlauschen waehrend des Spiels stoerte das staendig. */
  const Voice = {
    supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
                  (window.AudioContext || window.webkitAudioContext)),
    ctx: null, analyser: null, stream: null, buf: null, raf: 0,
    active: false, armed: true, noiseFloor: 0.02,
    clapCount: 0, clapTimer: null, muteUntil: 0, aboveSince: 0,

    async start() {
      if (!this.supported) { toast("Klatsch-Steuerung wird hier nicht unterstützt"); return; }
      if (AutoRally.active) AutoRally.stop();              // Mikro nicht doppelt belegen
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (_) { toast("Mikrofon-Zugriff nötig"); return; }
      this.active = true; // blockiert Re-Entry, falls waehrend der Kalibrierung nochmal geklickt wird
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.fftSize);
      this.armed = true; this.clapCount = 0; this.muteUntil = 0; this.aboveSince = 0;
      setVoiceUI(true);
      await this.autoBaseline();
      if (!this.active) return; // inzwischen wieder gestoppt
      this.loop();
      const n1 = S.names[1] || "Spieler 1", n2 = S.names[2] || "Spieler 2";
      toast(`Klatsch-Steuerung an – 1× = ${n1}, 2× = ${n2}`);
    },

    autoBaseline() {
      // kurze, stille Messung beim Start (siehe app.js audio.autoBaseline)
      return new Promise((resolve) => {
        const samples = [];
        const t0 = performance.now();
        const grab = () => {
          this.analyser.getByteTimeDomainData(this.buf);
          let p = 0;
          for (let i = 0; i < this.buf.length; i++) p = Math.max(p, Math.abs(this.buf[i] - 128) / 128);
          samples.push(p);
          if (performance.now() - t0 < 400) requestAnimationFrame(grab);
          else { this.noiseFloor = samples.reduce((a, b) => a + b, 0) / samples.length; resolve(); }
        };
        requestAnimationFrame(grab);
      });
    },

    loop() {
      if (!this.active) return;
      this.analyser.getByteTimeDomainData(this.buf);
      let peak = 0;
      for (let i = 0; i < this.buf.length; i++) { const v = Math.abs(this.buf[i] - 128) / 128; if (v > peak) peak = v; }
      if (peak < this.noiseFloor + 0.02) this.noiseFloor = this.noiseFloor * 0.97 + peak * 0.03;
      // deutlich groessere Marge als beim Rally-Zaehler: ein Klatscher ist ein
      // kurzer, scharfer Impuls, kein Dauergeraeusch - so faellt Gemurmel/Ballwechsel raus
      const threshold = this.noiseFloor + 0.16;
      const now = performance.now();
      if (now >= this.muteUntil) {
        if (this.armed && peak >= threshold) {
          this.armed = false;
          this.aboveSince = now;
        } else if (!this.armed && peak < threshold * 0.55) {
          this.armed = true;
          // nur kurze, scharfe Impulse zaehlen - Sprechen/Reden haelt viel laenger an
          if (now - this.aboveSince <= 130) this.registerClap();
        }
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },

    registerClap() {
      this.clapCount++;
      clearTimeout(this.clapTimer);
      this.clapTimer = setTimeout(() => this.finalizeClaps(), 550);
    },

    finalizeClaps() {
      const p = this.clapCount >= 2 ? 2 : 1;
      this.clapCount = 0;
      if (S.matchOver) { toast("Match ist beendet"); return; }
      addPoint(p);
      winAnim(p);
      this.muteUntil = performance.now() + 1200; // Jubel/Reden nach dem Punkt nicht als Klatscher werten
    },

    stop(silent) {
      this.active = false;
      clearTimeout(this.clapTimer); this.clapCount = 0;
      cancelAnimationFrame(this.raf);
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.ctx) { try { this.ctx.close(); } catch (_) {} }
      this.ctx = this.analyser = this.stream = null;
      setVoiceUI(false);
      if (!silent) toast("Klatsch-Steuerung aus");
    },

    toggle() { this.active ? this.stop() : this.start(); },
  };

  function setVoiceUI() {
    const btn = $("voiceBtn");
    if (btn) {
      btn.textContent = "🎤";
      btn.classList.toggle("live", Voice.active);
      btn.setAttribute("aria-label", Voice.active ? "Klatsch-Steuerung stoppen" : "Klatsch-Steuerung starten");
      btn.title = Voice.active ? "Klatsch-Steuerung stoppen" : "Klatsch-Steuerung starten";
    }
  }
  function updateVoiceBtn() { setVoiceUI(); }
  function updateMicBanner() {}

  /* Querformat/Hochformat – "auto" folgt der Geräte-Ausrichtung, sonst erzwungen */
  function applyLayout() {
    const eff = S.layout === "auto"
      ? (window.innerWidth >= window.innerHeight ? "landscape" : "portrait")
      : S.layout;
    const app = document.querySelector(".app");
    if (app) app.dataset.eff = eff;
  }

  /* Bildschirm anlassen: Wake Lock API (iOS ab Safari 16.4) + ein unsichtbares
     Canvas-Video als Fallback/Ergänzung ("NoSleep"-Trick). Grund: in der
     installierten iOS-PWA fällt das Wake-Lock öfters still wieder weg, ohne
     dass "visibilitychange" feuert (Seite bleibt sichtbar) – dann dimmt das
     Display nach ein paar Minuten trotzdem. Der Video-Trick hält zusätzlich
     wach und wird per Intervall regelmäßig neu abgesichert. */
  const Wake = {
    lock: null, vid: null, drawTimer: null,
    ensureVideo() {
      if (this.vid) return this.vid;
      const canvas = document.createElement("canvas");
      canvas.width = 2; canvas.height = 2;
      const ctx = canvas.getContext("2d");
      let toggle = false;
      const draw = () => {
        toggle = !toggle;
        ctx.fillStyle = toggle ? "#000" : "#010101";
        ctx.fillRect(0, 0, 2, 2);
      };
      draw();
      const stream = canvas.captureStream(1);
      const video = document.createElement("video");
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.style.cssText = "position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;";
      video.srcObject = stream;
      document.body.appendChild(video);
      this.drawTimer = setInterval(draw, 1000);
      this.vid = video;
      return video;
    },
    async apply() {
      if (S.keepAwake && document.visibilityState === "visible") {
        if ("wakeLock" in navigator && !this.lock) {
          try {
            this.lock = await navigator.wakeLock.request("screen");
            this.lock.addEventListener("release", () => { this.lock = null; });
          } catch (_) {}
        }
        const v = this.ensureVideo();
        v.play().catch(() => {});
      } else {
        if (this.lock) { try { this.lock.release(); } catch (_) {} this.lock = null; }
        if (this.vid) this.vid.pause();
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
    if (mode === "pending") el.textContent = `🏁 Punkt! (${hits} Schläge) - wer? 1x/2x klatschen oder tippen`;
    else if (mode === "done") el.textContent = "🏆 Match beendet";
    else el.textContent = hits > 0 ? `🎧 Ballwechsel läuft · ${hits} Schläge` : "🎧 Auto-Rally aktiv · spielt los";
  }

  const AutoRally = {
    active: false, state: "off",
    ctx: null, analyser: null, stream: null, buf: null, raf: 0,
    armed: true, noiseFloor: 0.02, hits: 0, lastHit: 0, endMs: 1800,
    winArmed: true, winClaps: 0, winTimer: null, winAboveSince: 0,

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
      await this.autoBaseline(); // Grundpegel geraeteabhaengig messen (Mikros streuen stark)
      setAutoUI(true); updateVoiceBtn();
      this.beginRally();
      this.loop();
      toast("🎧 Auto-Rally an – einfach spielen");
    },

    autoBaseline() {
      // kurze, stille Messung beim Start (siehe app.js audio.autoBaseline)
      return new Promise((resolve) => {
        const samples = [];
        const t0 = performance.now();
        const grab = () => {
          this.analyser.getByteTimeDomainData(this.buf);
          let p = 0;
          for (let i = 0; i < this.buf.length; i++) p = Math.max(p, Math.abs(this.buf[i] - 128) / 128);
          samples.push(p);
          if (performance.now() - t0 < 400) requestAnimationFrame(grab);
          else {
            this.noiseFloor = samples.reduce((a, b) => a + b, 0) / samples.length;
            resolve();
          }
        };
        requestAnimationFrame(grab);
      });
    },

    beginRally() { this.state = "listening"; this.hits = 0; this.lastHit = 0; showAutoBanner("listening", 0); },

    loop() {
      if (!this.active) return;
      this.analyser.getByteTimeDomainData(this.buf);
      let peak = 0;
      for (let i = 0; i < this.buf.length; i++) { const v = Math.abs(this.buf[i] - 128) / 128; if (v > peak) peak = v; }
      if (peak < this.noiseFloor + 0.02) this.noiseFloor = this.noiseFloor * 0.97 + peak * 0.03;
      const now = performance.now();
      if (this.state === "listening") {
        const threshold = this.noiseFloor + 0.04;   // dicht über Grundpegel = empfindlich
        if (this.armed && peak >= threshold) {
          this.armed = false; this.hits++; this.lastHit = now;
          if (S.vibrate && navigator.vibrate) navigator.vibrate(6);
          showAutoBanner("listening", this.hits);
        } else if (!this.armed && peak < threshold * 0.55) {
          this.armed = true;
        }
        if (this.hits > 0 && now - this.lastHit > this.endMs) this.endRally();
      } else if (this.state === "pending") {
        // Wer hat gewonnen? -> 1x klatschen = Spieler 1, 2x klatschen = Spieler 2
        // (bewusst kein SpeechRecognition hier - deren Android-Systempiepton
        // würde bei jedem Neustart-Zyklus während der Wartezeit ausgelöst)
        const threshold = this.noiseFloor + 0.16; // groessere Marge: Klatscher statt Reden/Ballwechsel
        if (this.winArmed && peak >= threshold) {
          this.winArmed = false;
          this.winAboveSince = now;
        } else if (!this.winArmed && peak < threshold * 0.55) {
          this.winArmed = true;
          // nur kurze, scharfe Impulse zaehlen - Sprechen/Reden haelt viel laenger an
          if (now - this.winAboveSince <= 130) {
            this.winClaps++;
            clearTimeout(this.winTimer);
            this.winTimer = setTimeout(() => {
              const p = this.winClaps >= 2 ? 2 : 1;
              this.winClaps = 0;
              this.assign(p);
            }, 550);
          }
        }
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },

    endRally() {
      this.state = "pending";
      this.winArmed = true; this.winClaps = 0; clearTimeout(this.winTimer);
      showAutoBanner("pending", this.hits);
      if (navigator.vibrate) navigator.vibrate(40);
      const sb = $("scoreboard"); if (sb) sb.classList.add("await-pick");
    },

    assign(p) {                       // Gewinner per Klatscher ODER Tipp
      if (!this.active) return;
      clearTimeout(this.winTimer); this.winClaps = 0;
      const sb = $("scoreboard"); if (sb) sb.classList.remove("await-pick");
      addPoint(p); winAnim(p);
      if (S.matchOver) { this.state = "matchover"; showAutoBanner("done", 0); }
      else this.beginRally();
    },

    stop() {
      this.active = false; this.state = "off";
      cancelAnimationFrame(this.raf);
      clearTimeout(this.winTimer); this.winClaps = 0;
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
    $("autoBanner").addEventListener("click", () => Voice.toggle());
    $("voiceBtn").addEventListener("click", () => Voice.toggle());
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
    ["soundToggle", "rallySoundToggle"].forEach((id) => {
      const el = $(id); if (!el) return;
      el.addEventListener("change", (e) => { S.sound = e.target.checked; syncGlobalToggles(); saveCfg(); });
    });
    ["helpToggle", "rallyHelpToggle"].forEach((id) => {
      const el = $(id); if (!el) return;
      el.addEventListener("change", (e) => {
        S.showHelp = e.target.checked;
        syncGlobalToggles(); saveCfg();
      });
    });
    const sixTogEl = $("sixsevenToggle");
    if (sixTogEl) sixTogEl.addEventListener("change", (e) => { S.sixseven = e.target.checked; saveCfg(); });
    $("layoutSel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      S.layout = b.dataset.lay; pickSegment($("layoutSel"), S.layout, "lay"); saveCfg(); applyLayout();
    });
    window.addEventListener("resize", applyLayout);
    window.addEventListener("orientationchange", applyLayout);
    applyLayout();
    document.addEventListener("visibilitychange", () => Wake.apply());
    Wake.apply();
    setInterval(() => Wake.apply(), 20000);  // gegen stilles Verfallen des Locks (v.a. iOS)
    document.addEventListener("pointerdown", () => Wake.apply(), { once: true }); // erste Geste: Video darf starten

    function rallyHelpCopy() {
      const mode = typeof window.__rallyMode === "function" ? window.__rallyMode() : "visual";
      if (mode === "audio") return {
        key: "tt.helpRallyAudioSeen",
        icon: "🔊",
        title: "Rally per Ton",
        text: "Ton erkennt Schlag- und Tischgeraeusche. Am besten ist es rundherum ruhig, damit keine anderen Geraeusche mitgezaehlt werden.",
      };
      if (mode === "manual") return {
        key: "tt.helpRallyManualSeen",
        icon: "👆",
        title: "Rally per Tippen",
        text: "Start druecken und pro Schlag auf die grosse Flaeche tippen. Nach einer Pause wird der Ballwechsel automatisch abgeschlossen.",
      };
      return {
        key: "tt.helpRallyVisualSeen",
        icon: "📷",
        title: "Rally per Kamera",
        text: "Kamera auf ein Stativ stellen und ruhig auf Tisch und Mittellinie ausrichten. Im Hintergrund darf sich nichts bewegen - nur der Ball soll durchs Bild fliegen.",
      };
    }
    const helpCopy = {
      score: () => ({
        key: "tt.helpScoreSeen",
        icon: "🏓",
        title: "Hinweis",
        text: "Tippe auf eine grosse Zahl, um einen Punkt zu vergeben. Oder tippe auf das Mikrofon und klatsche 1x (Spieler 1) oder 2x (Spieler 2).",
      }),
      rally: rallyHelpCopy,
    };
    showHelp = (kind) => {
      const getCfg = helpCopy[kind];
      const cfg = typeof getCfg === "function" ? getCfg() : getCfg;
      if (!cfg || !S.showHelp) return;
      const help = $("helpBackdrop");
      if (!help) return;
      $("helpIcon").textContent = cfg.icon;
      $("helpTitle").textContent = cfg.title;
      $("helpText").textContent = cfg.text;
      help.hidden = false;
    };
    window.__showHelp = showHelp;
    $("helpOk").addEventListener("click", () => { $("helpBackdrop").hidden = true; });
    syncGlobalToggles();

    const splashInfo = $("splashInfo");
    const splashCompany = $("splashCompany");
    if (splashCompany && splashInfo) splashCompany.addEventListener("click", () => { splashInfo.hidden = false; });
    const splashInfoOk = $("splashInfoOk");
    if (splashInfoOk && splashInfo) splashInfoOk.addEventListener("click", () => { splashInfo.hidden = true; });

    const splashBtn = $("splashBtn");
    if (splashBtn) {
      splashBtn.addEventListener("click", () => {
        const sp = $("splash");
        document.body.classList.remove("splashing");
        if (sp) { sp.classList.add("fade-out"); setTimeout(() => { sp.remove(); showHelp("score"); }, 400); }
      });
    } else {
      document.body.classList.remove("splashing");
      setTimeout(() => showHelp("score"), 300);
    }

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
