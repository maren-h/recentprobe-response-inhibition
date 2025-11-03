(() => {
  'use strict';

  function getParam(name) {
    const u = new URL(window.location.href);
    let v = u.searchParams.get(name);
    if (!v && u.hash.includes('?')) {
      const hashQuery = u.hash.split('?')[1].split('#')[0];
      v = new URLSearchParams(hashQuery).get(name);
    }
    return v ? decodeURIComponent(v).trim() : "";
  }
  const participantId =
    getParam('REDCapID') ||
    getParam('record_id') ||
    getParam('rid') ||
    getParam('id') ||
    "";

  let fixationText = '+';
  let arrowSymbol = { left: '←', right: '→' };

  let lastKeyCode = null;
  let showErrorUntil = 0;
  let responseTimestampMs = null;
  let currentTrialSSD = null;
  let experimentStartMs = null;
  let experimentDateStr = null;
  let experimentStartTimeStr = null;
  let csvSaved = false;
  let exp2Cleaned = false;

  let __exp2PrevStyles;
  let __exp2UiLocked = false;

  function lockExp2UI() {
    if (__exp2UiLocked) return;
    __exp2PrevStyles = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      htmlBg:       document.documentElement.style.background,
      bodyBg:       document.body.style.background
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow            = 'hidden';
    document.documentElement.style.background = '#000';
    document.body.style.background            = '#000';
    __exp2UiLocked = true;
  }
  function unlockExp2UI() {
    if (!__exp2UiLocked) return;
    document.documentElement.style.overflow  = __exp2PrevStyles.htmlOverflow || '';
    document.body.style.overflow             = __exp2PrevStyles.bodyOverflow || '';
    document.documentElement.style.background = __exp2PrevStyles.htmlBg || '';
    document.body.style.background            = __exp2PrevStyles.bodyBg || '';
    __exp2UiLocked = false;
  }

  // Stimulusgrößen
  const FIXATION_PX = 48;
  const ARROW_PX    = 48;
  let arrowOffset   = 100;

  // Ellipse
  let ellipseW = 400;
  let ellipseH = 200;

  // Stop-Signal-Parameter
  let ssd = 0.220;
  const ssdStep = 0.050;
  const minSSD  = 0.020;
  const maxSSD  = 0.900;

  // Trial-Setup
  const trialsPerSet = 68;
  const totalSets    = 3;

  const PRACTICE_FEEDBACK_MS = 6000;
  const MAIN_FEEDBACK_MS = 500;

  const practiceTrials = 20;
  let practiceMode = true;
  let practiceJustFinished = false;

  let currentSet = 0;
  let setTrialIndex = 0;
  let currentTrial;
  let fullData = [];

  let trialList = [];

  let state = 'intro';
  let trialStartTime = 0;
  let responded = false;
  let stopPresented = false;

  // Global fallback for key events if canvas loses focus
  window.addEventListener('keydown', (e) => {
    if (state !== 'stimulus' || responded) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      responded = true;
      lastKeyCode = (e.key === 'ArrowLeft') ? LEFT_ARROW : RIGHT_ARROW;
      responseTimestampMs = nowMs();
      handleResponse();
      state = 'interTrial';
      trialStartTime = nowMs();
    }
  }, { passive: false });

  let isiDuration = 0;
  const fixationDuration   = 0.5; // 500 ms Fixation
  const preEllipseDuration = 0.5; // 500 ms weiße Ellipse + Fixation (kein Pfeil)
  const stimulusDuration   = 2.0; // 2000 ms max. (oder bis Tastendruck)
  let ellipseShouldBeBlue = false;

  let exp2HasStarted = false;
  let revealCanvasRequested = false;

  const nowMs = () => (typeof millis === 'function' ? millis() : performance.now());
  const pad = n => String(n).padStart(2,'0');
  function fmtDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function fmtTime(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

  function enterFullscreen() {
    const el  = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      try { req.call(el, { navigationUI: "hide" }); }
      catch { req.call(el); }
    }
  }

  function startSecondExperiment() {
    if (exp2HasStarted) return;
    exp2HasStarted = true;
    revealCanvasRequested = true;

    enterFullscreen();

    const stim = document.getElementById('stimulus');
    if (stim) stim.style.display = 'none';
    const btn = document.getElementById('download-btn');
    if (btn) btn.style.display = 'none';

    lockExp2UI();

    practiceMode = true;
    practiceJustFinished = false;
    currentSet = 0;
    setTrialIndex = 0;
    trialList = [];
    fullData = [];

    responded = false;
    stopPresented = false;
    ellipseShouldBeBlue = false;
    showErrorUntil = 0;

    ssd = 0.220;

    const start = new Date();
    experimentStartMs = start.getTime();
    experimentDateStr = fmtDate(start);
    experimentStartTimeStr = fmtTime(start);

    (function bootWhenReady() {
      const canvasEl = document.querySelector('canvas');
      const p5Ready  = (typeof randomGaussian === 'function') && (typeof millis === 'function');
      if (canvasEl && p5Ready) {
        canvasEl.style.display = 'block';
        state = 'intro';
        trialStartTime = nowMs();
      } else {
        setTimeout(bootWhenReady, 30);
      }
    })();
  }

  function setup() {
    const c = createCanvas(windowWidth, windowHeight);
    c.elt.style.display  = revealCanvasRequested ? 'block' : 'none';
    c.elt.style.position = 'fixed';
    c.elt.style.inset    = '0';
    c.elt.style.zIndex   = '2';

    // Make canvas focusable and focus it
    c.elt.setAttribute('tabindex', '0');
    setTimeout(() => c.elt.focus(), 0);

    textAlign(LEFT, TOP);
    textWrap(WORD);
    textLeading(30);
    frameRate(60);
    fill(255);

    state = 'intro';
  }
  function windowResized() { resizeCanvas(windowWidth, windowHeight); }

  function keyPressed() {
    if (state === 'intro') {
      startSet();
    } else if (state === 'practiceEnd') {
      practiceJustFinished = false;
      startSet();
    } else if (state === 'break') {
      startSet();
    } else if (state === 'end') {
      // nothing
    } else if (state === 'stimulus' && !responded) {
      responded = true;
      lastKeyCode = keyCode;
      responseTimestampMs = nowMs();
      handleResponse();
      state = 'interTrial';
      trialStartTime = nowMs();
    }
  }

  // --- EXAKTE Anzahlen pro Set: 41/9/9/9 ---
  function generateTrials() {
    const n_congruent   = 41;
    const n_incongruent = 9;
    const n_nogo        = 9;
    const n_stop        = 9;

    let trialList = [];

    function addTrials(type, count) {
      for (let i = 0; i < count; i++) {
        let direction = random(['left', 'right']); // Bildschirmseite
        trialList.push({ type, direction });
      }
    }

    addTrials('congruent_go',   n_congruent);
    addTrials('incongruent_go', n_incongruent);
    addTrials('nogo',           n_nogo);
    addTrials('stop',           n_stop);

    return shuffle(trialList);
  }

  function startSet() {
    // Ensure focus on the canvas
    const __canvasEl = document.querySelector('canvas');
    if (__canvasEl) __canvasEl.focus();

    // Fallback initialization of experiment start time/date if missing
    if (experimentStartMs == null || !experimentDateStr || !experimentStartTimeStr) {
      const __start = new Date();
      experimentStartMs = __start.getTime();
      experimentDateStr = fmtDate(__start);
      experimentStartTimeStr = fmtTime(__start);
    }
    if (practiceMode) {
      const full = generateTrials();
      trialList = full.slice(0, practiceTrials);
      setTrialIndex = 0;
      currentTrial = trialList[setTrialIndex];
      isiDuration = Math.max(0.2, randomGaussian(1.5, 0.372));
      state = 'ISI';
      trialStartTime = nowMs();
      responded = false;
      stopPresented = false;
      ellipseShouldBeBlue = false;
      return;
    }

    currentSet++;
    if (currentSet > totalSets) {
      state = 'end';
      if (!csvSaved) { csvSaved = true; setTimeout(downloadCSV, 0); }
      return;
    }

    trialList = generateTrials();
    setTrialIndex = 0;
    currentTrial = trialList[setTrialIndex];
    isiDuration = Math.max(0.2, randomGaussian(1.5, 0.372));
    state = 'ISI';
    trialStartTime = nowMs();
    responded = false;
    stopPresented = false;
    ellipseShouldBeBlue = false;
  }

  function draw() {
    background(0);
    fill(255);
    let elapsed = (nowMs() - trialStartTime) / 1000;

    if (state === 'intro') {
      drawIntro();

    } else if (state === 'practiceEnd') {
      drawPracticeEndScreen_Exp2();

    } else if (state === 'break') {
      drawBreakScreen();

    } else if (state === 'ISI') {
      if (elapsed >= isiDuration) {
        state = 'fixation';
        trialStartTime = nowMs();
      }

    } else if (state === 'fixation') {
      // nur Fixationskreuz (500 ms)
      drawFixation();
      if (elapsed >= fixationDuration) {
        state = 'ellipsePrime';
        trialStartTime = nowMs();
      }

    } else if (state === 'ellipsePrime') {
      // 500 ms weiße Ellipse + Fixation, noch kein Pfeil
      drawEllipse('white');
      drawFixation();
      if (elapsed >= preEllipseDuration) {
        state = 'stimulus';
        trialStartTime = nowMs();
        currentTrialSSD = ssd;
        stopPresented = false;
        ellipseShouldBeBlue = false;
      }

    } else if (state === 'stimulus') {
      // Stimulus: max 2000 ms oder bis Tastendruck
      let stimSide   = currentTrial.direction;                  // Position
      let arrowPoint = (currentTrial.type === 'incongruent_go') // Richtung
        ? (stimSide === 'left' ? 'right' : 'left')
        : stimSide;

      // NoGo sofort blau, Stop nach SSD
      if (currentTrial.type === 'nogo') {
        ellipseShouldBeBlue = true;
      } else if (currentTrial.type === 'stop' && !stopPresented && elapsed >= ssd) {
        ellipseShouldBeBlue = true;
        stopPresented = true;
      }

      const arrowDisplayOffset = arrowOffset * (stimSide === 'left' ? -1 : 1);

      drawEllipse(ellipseShouldBeBlue ? 'blue' : 'white');
      drawFixation();
      // Pfeil wird in allen Stimulus-Typen gezeigt (auch NoGo), wie von dir gewünscht
      drawArrow(arrowSymbol[arrowPoint], arrowDisplayOffset);

      if (nowMs() < showErrorUntil) drawErrorMark();

      if (elapsed >= stimulusDuration && !responded) {
        handleResponse(stimSide, arrowPoint);
        state = 'interTrial';
        trialStartTime = nowMs();
      }

    } else if (state === 'interTrial') {
      if (nowMs() < showErrorUntil) drawErrorMark();

      const baseITIpassed  = (elapsed >= 0.5);
      const feedbackPassed = (nowMs() >= showErrorUntil);

      if (baseITIpassed && feedbackPassed) {
        setTrialIndex++;
        const endOfThisList = setTrialIndex >= trialList.length;

        if (endOfThisList) {
          if (practiceMode) {
            practiceMode = false;
            practiceJustFinished = true;
            state = 'practiceEnd';
          } else {
            if (currentSet < totalSets) {
              state = 'break';
            } else {
              state = 'end';
              if (!csvSaved) { csvSaved = true; setTimeout(downloadCSV, 0); }
            }
          }
        } else {
          currentTrial = trialList[setTrialIndex];
          isiDuration = Math.max(0.2, randomGaussian(1.5, 0.372));
          state = 'ISI';
          trialStartTime = nowMs();
          responded = false;
          stopPresented = false;
          ellipseShouldBeBlue = false;
        }
      }

    } else if (state === 'end') {
      drawEndScreen();
    }
  }

  function drawIntro() {
    background(0);
    textSize(18);
    textAlign(CENTER, CENTER);
    const textLines = `Experiment 2

Drücken Sie eine beliebige Taste, um zu starten.`;
    text(textLines, width / 2, height / 2);
  }
  function drawPracticeEndScreen_Exp2() {
    background(0);
    textSize(18);
    textAlign(CENTER, CENTER);
    textWrap(WORD);
    const textLines = `Der Übungsblock ist beendet.
Jetzt startet der erste richtige Durchgang von Experiment 2.

Zur Erinnerung: Reagieren Sie mit den Pfeiltasten auf die Richtung, in die der Pfeil zeigt.
Drücken Sie keine Taste, wenn die Ellipse in Blau erscheint.
Drücken Sie auch dann keine Taste, wenn die Ellipse zuerst in Weiß erscheint und dann zu Blau wechselt.

Drücken Sie eine beliebige Taste, um zu beginnen.`;
    text(textLines, width / 2, height / 2);
  }
  function drawBreakScreen() {
    background(0);
    textSize(18);
    textAlign(CENTER, CENTER);
    const textLines = `Sie haben ${currentSet} von ${totalSets} Blöcken abgeschlossen.
Wenn Sie möchten, können Sie eine kurze Pause machen.
Wenn Sie wieder bereit sind, drücken Sie eine beliebige Taste, um fortzufahren.

Zur Erinnerung: Reagieren Sie mit den Pfeiltasten auf die Richtung, in die der Pfeil zeigt.
Drücken Sie keine Taste, wenn die Ellipse in Blau erscheint.
Drücken Sie auch dann keine Taste, wenn die Ellipse zuerst in Weiß erscheint und dann zu Blau wechselt.

Drücken Sie eine beliebige Taste, um zu beginnen.`;
    text(textLines, width / 2, height / 2);
  }
  function drawEndScreen() {
    background(0);
    textSize(18);
    textAlign(CENTER, CENTER);
    const textLines = `Vielen Dank für Ihre Teilnahme an dieser Studie!

Wenden Sie sich nun an die Versuchsleitung.`;
    text(textLines, width / 2, height / 2);
    if (!csvSaved) { csvSaved = true; setTimeout(downloadCSV, 0); }
    if (!exp2Cleaned) { exp2Cleaned = true; unlockExp2UI(); }
  }

  function drawFixation() {
    textSize(FIXATION_PX);
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    text(fixationText, width / 2, height / 2);
  }
  function drawEllipse(colorName) {
    noFill();
    strokeWeight(3);
    stroke(colorName === 'blue' ? color(0, 0, 255) : color(255));
    ellipse(width / 2, height / 2, ellipseW, ellipseH);
  }
  function drawArrow(symbol, xOffset) {
    textSize(ARROW_PX);
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    text(symbol, width / 2 + xOffset, height / 2);
  }
  function drawErrorMark() {
    push();
    const baseY = Math.round(height * 0.70);
    textAlign(CENTER, CENTER);
    textSize(ARROW_PX);
    fill(255, 0, 0);
    noStroke();
    text('!', width / 2, baseY);
    if (practiceMode) {
      const textStartY = baseY + 80;
      textSize(16);
      fill(255);
      textAlign(CENTER, TOP);
      const reminder = `Zur Erinnerung:
Reagieren Sie mit den Pfeiltasten auf die Richtung, in die der Pfeil zeigt.
Drücken Sie keine Taste, wenn die Ellipse in Blau erscheint.
Drücken Sie auch dann keine Taste, wenn die Ellipse zuerst in Weiß erscheint und dann zu Blau wechselt.`;
      text(reminder, width / 2, textStartY);
    }
    pop();
  }

  function handleResponse(stimSideArg, arrowPointArg) {
    if (!currentTrial) return;

    // adaptives SSD nur für Stop-Trials
    if (currentTrial.type === 'stop') {
      if (responded) ssd = Math.max(minSSD, ssd - ssdStep);
      else           ssd = Math.min(maxSSD, ssd + ssdStep);
    }

    let pressedKey = 'none';
    if (responded) {
      pressedKey = (lastKeyCode === LEFT_ARROW)  ? 'left'
                : (lastKeyCode === RIGHT_ARROW) ? 'right'
                : 'other';
    }
    let rt_ms = responded && responseTimestampMs != null
                ? Math.round(responseTimestampMs - trialStartTime)
                : null;

    let isError = false;
    let correct = false;

    const expectedKey =
      (currentTrial.type === 'incongruent_go')
        ? (currentTrial.direction === 'left' ? 'right' : 'left')
        : currentTrial.direction;

    if (currentTrial.type === 'congruent_go' || currentTrial.type === 'incongruent_go') {
      if (!responded) {
        isError = true;            // Auslassung
      } else {
        correct = (pressedKey === expectedKey);
        isError = !correct;
      }
    } else if (currentTrial.type === 'nogo' || currentTrial.type === 'stop') {
      if (responded) { isError = true; correct = false; }
      else           { correct = true; }
    }

    showErrorUntil = isError
      ? nowMs() + (practiceMode ? PRACTICE_FEEDBACK_MS : MAIN_FEEDBACK_MS)
      : 0;

    if (currentSet > 0) {
      const stimSideLogged   = currentTrial.direction;
      const arrowPointLogged = expectedKey;

      fullData.push({
        set: currentSet,
        trial: setTrialIndex + 1,
        type: currentTrial.type,
        stimSide: stimSideLogged,
        arrowPoint: arrowPointLogged,
        pressedKey: pressedKey,
        responded: responded,
        correct: !!correct,
        rt_ms: rt_ms,
        ssd: currentTrialSSD,
        ellipseColor: ellipseShouldBeBlue ? 'blue' : 'white'
      });
    }
  }

  function downloadCSV() {
    const end = new Date();
    const experimentEndMs = end.getTime();
    const totalMs = experimentStartMs ? (experimentEndMs - experimentStartMs) : null;

    let lines = [];
    // Final safeguard: ensure start date/time are set
    if (experimentStartMs == null || !experimentDateStr || !experimentStartTimeStr) {
      const __start2 = new Date();
      experimentStartMs = __start2.getTime();
      experimentDateStr = fmtDate(__start2);
      experimentStartTimeStr = fmtTime(__start2);
    }
    lines.push(`#${experimentDateStr};${experimentStartTimeStr};${totalMs != null ? totalMs : ""}`);

    lines.push("recordId;Set;Trial;Type;StimSide;ArrowPoint;PressedKey;Responded;Correct;RT_ms;SSD;EllipseColor");

    fullData.forEach(d => {
      const rtStr  = (d.rt_ms == null) ? "" : d.rt_ms;
      const ssdStr = (d.ssd == null)   ? "" : d.ssd;
      lines.push([
        participantId, d.set, d.trial, d.type, d.stimSide, d.arrowPoint,
        d.pressedKey, d.responded, d.correct, rtStr, ssdStr, d.ellipseColor
      ].join(";"));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "experiment2_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function shuffle(array) {
    let currentIndex = array.length, temp, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = floor(random(currentIndex));
      currentIndex--;
      temp = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temp;
    }
    return array;
  }

  window.startSecondExperiment = startSecondExperiment;
  window.setup = setup;
  window.draw = draw;
  window.keyPressed = keyPressed;
})();













