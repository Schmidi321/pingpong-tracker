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
    render(); buzz(14);
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
  function showWinner(p) {
    $("winnerName").textContent = S.names[p];
    $("winnerSub").textContent = `gewinnt ${S.sets[p]} : ${S.sets[other(p)]}`;
    $("winner").hidden = false;
  }

  /* ----------------------------- Config ------------------------- */
  function saveCfg() {
    try {
      localStorage.setItem("tt.cfg", JSON.stringify({
        names: S.names, ppg: S.ppg, bestOf: S.bestOf, mfs: S.matchFirstServer, vib: S.vibrate,
      }));
    } catch (e) {}
  }
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem("tt.cfg") || "null");
      if (!c) return;
      if (c.names) S.names = c.names;
      S.ppg = c.ppg || 11; S.bestOf = c.bestOf || 5;
      S.matchFirstServer = c.mfs || 1; S.vibrate = c.vib !== false;
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
    $("scoreVibrate").checked = S.vibrate;
  }

  /* --------------------------- Sheet/Tabs ----------------------- */
  let activeView = "score";
  const openScoreSheet = () => { syncSettingsUI(); $("scoreSheet").hidden = false; $("sheetBackdrop").hidden = false; };
  const closeScoreSheet = () => { $("scoreSheet").hidden = true; $("sheetBackdrop").hidden = true; };

  function switchView(v) {
    activeView = v;
    $("view-score").hidden = v !== "score";
    $("view-rally").hidden = v !== "rally";
    document.querySelectorAll("#tabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === v));
    if (v !== "rally" && typeof window.__rallyStop === "function") window.__rallyStop();
    if (v !== "score") Voice.stop(true);   // Sprache nur im Punkte-Tab
    updateVoiceBtn();
  }

  /* ----------------------- Sprachsteuerung ---------------------- */
  /* "eins"/"1" → Punkt für Spieler 1, "zwei"/"2" → Spieler 2.
     Web Speech API (Chrome/Edge/Android), braucht Mikrofon + HTTPS. */
  function parsePlayer(txt) {
    let p = 0;
    for (const t of txt.toLowerCase().replace(/[.,!?]/g, " ").split(/\s+/)) {
      if (t === "1" || t === "eins" || t === "ein" || t === "eis") p = 1;
      else if (t === "2" || t === "zwei" || t === "zwo" || t === "zwein") p = 2;
    }
    return p; // die zuletzt genannte Zahl gewinnt
  }

  const Voice = {
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    rec: null, active: false, last: 0,

    start() {
      if (!this.supported) { toast("Sprachsteuerung wird hier nicht unterstützt"); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "de-DE";
      rec.continuous = true;
      rec.interimResults = false;            // nur Endergebnisse → kein interim/final-Doppelzählen
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (!res.isFinal) continue;        // jedes Wort wird genau einmal gewertet
          const p = parsePlayer(res[0].transcript);
          if (!p) continue;
          const now = performance.now();
          if (now - this.last < 400) continue;   // Sicherheits-Entprellung
          this.last = now;
          if (S.matchOver) { toast("Match ist beendet"); return; }
          addPoint(p);
          winAnim(p);
        }
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

  function setVoiceUI(on) {
    const b = $("voiceBtn");
    if (b) b.classList.toggle("live", on);
  }
  function updateVoiceBtn() {
    const b = $("voiceBtn");
    if (b) b.hidden = !(Voice.supported && activeView === "score");
  }

  /* ----------------------------- Init --------------------------- */
  function init() {
    loadCfg();

    $("halfP1").addEventListener("click", () => addPoint(1));
    $("halfP2").addEventListener("click", () => addPoint(2));
    $("undoBtn").addEventListener("click", undo);
    $("newMatchBtn").addEventListener("click", () => { newMatch(); toast("Neues Match"); });
    $("winnerNew").addEventListener("click", () => { newMatch(); toast("Neues Match"); });
    $("voiceBtn").addEventListener("click", () => Voice.toggle());
    updateVoiceBtn();

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

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
