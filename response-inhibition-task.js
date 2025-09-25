(() => {
  'use strict';
let fixationText = '+';
let arrowSymbol = { left: '←', right: '→' };

// Stimulusgrößen (wie Exp.1: 48px)
const FIXATION_PX = 48;
const ARROW_PX    = 48;
let arrowOffset   = 100;   // in px

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

let isiDuration = 0;
const fixationDuration = 0.5;
const stimulusDuration = 1.0;
let ellipseShouldBeBlue = false;


let exp2HasStarted = false;      
let revealCanvasRequested = false; 

const nowMs = () => (typeof millis === 'function' ? millis() : performance.now());

function startSecondExperiment() {
  if (exp2HasStarted) return;
  exp2HasStarted = true;
  revealCanvasRequested = true;

  (function bootWhenReady() {
    const canvasEl = document.querySelector('canvas');
    const p5Ready  = (typeof randomGaussian === 'function') && (typeof millis === 'function');
    if (canvasEl && p5Ready) {
      canvasEl.style.display = 'block';

    
      state = 'intro';
      responded = false;
      stopPresented = false;
      ellipseShouldBeBlue = false;
    } else {
      setTimeout(bootWhenReady, 30);
    }
  })();
}


function setup() {
  const c = createCanvas(windowWidth, windowHeight);

  if (revealCanvasRequested) c.elt.style.display = 'block';
  else c.elt.style.display = 'none';

  textAlign(LEFT, TOP);
  textWrap(WORD);
  textLeading(30);
  frameRate(60);
  fill(255);

  
  state = exp2HasStarted ? 'intro' : 'intro';
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (state === 'intro') {
    startSet();
  } else if (state === 'practiceEnd') {
    // erster echter Block
    practiceJustFinished = false;
    startSet();
  } else if (state === 'break') {
    startSet();
  } else if (state === 'end') {
    // Do nothing
  } else if (state === 'stimulus' && !responded) {
    responded = true;
    handleResponse();
    state = 'interTrial';
    trialStartTime = nowMs();
  }
}

function generateTrials() {
  const proportions = {
    congruent_go:   0.625,
    incongruent_go: 0.125,
    nogo:           0.125,
    stop:           0.125,
  };

  let trialList = [];

  const n_congruent   = Math.floor(trialsPerSet * proportions.congruent_go);
  const n_incongruent = Math.floor(trialsPerSet * proportions.incongruent_go);
  const n_nogo        = Math.floor(trialsPerSet * proportions.nogo);
  const n_stop        = trialsPerSet - n_congruent - n_incongruent - n_nogo;

  function addTrials(type, count) {
    for (let i = 0; i < count; i++) {
      let direction = random(['left', 'right']);
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
  if (practiceMode) {
    // einmaliger Übungsblock mit 10 Trials
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

  // ab hier: echte Sets
  currentSet++;
  if (currentSet > totalSets) {
    state = 'end';
    downloadCSV(); // trigger automatic download
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
    drawEllipse('white');
    drawFixation();
    if (elapsed >= fixationDuration) {
      state = 'stimulus';
      trialStartTime = nowMs();
    }
  } else if (state === 'stimulus') {
    let t = elapsed;

    let direction = currentTrial.direction;
    let arrowDir = direction;
    let arrowDisplayOffset = arrowOffset;

    if (currentTrial.type === 'incongruent_go') {
      arrowDir = direction === 'left' ? 'right' : 'left';
    }
    arrowDisplayOffset *= (arrowDir === 'left' ? -1 : 1);

    if (currentTrial.type === 'nogo') {
      ellipseShouldBeBlue = true;
    } else if (currentTrial.type === 'stop' && !stopPresented && t >= ssd) {
      ellipseShouldBeBlue = true;
      stopPresented = true;
    }

    drawEllipse(ellipseShouldBeBlue ? 'blue' : 'white');
    drawFixation();
    drawArrow(arrowSymbol[arrowDir], arrowDisplayOffset);

    if (t >= stimulusDuration && !responded) {
      handleResponse();
      state = 'interTrial';
      trialStartTime = nowMs();
    }
  } else if (state === 'interTrial') {
    if (elapsed >= 0.5) {
      setTrialIndex++;
      const endOfThisList = setTrialIndex >= trialList.length;

      if (endOfThisList) {
        if (practiceMode) {
          // Übung beendet -> Übergangsscreen
          practiceMode = false;
          practiceJustFinished = true;
          state = 'practiceEnd';
        } else {
          // normales Blockende
          if (currentSet < totalSets) {
            state = 'break';
          } else {
            state = 'end';
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
  textAlign(LEFT, TOP);
  textWrap(WORD);
  const margin = 50;
  const wrap = width - 2 * margin;
  const textLines = `Experiment 2\n\nDrücken Sie eine beliebige Taste, um zu starten.`;
  text(textLines, margin, 150, wrap);
}

function drawPracticeEndScreen_Exp2() {
  background(0);
  textSize(18);
  textAlign(LEFT, TOP);
  textWrap(WORD);
  const margin = 50;
  const wrap = width - 2 * margin;
  const textLines = `Der Übungsblock ist beendet.\n\n
  Jetzt startet der erste richtige Durchgang von Experiment 2.\n\n
  Zur Erinnerung: Reagieren Sie mit den Pfeiltasten auf die Richtung, in die der Pfeil zeigt.\n\n
  Drücken Sie keine Taste, wenn die Ellipse in Blau erscheint.
  Drücken Sie auch dann keine Taste, wenn die Ellipse zuerst in Weiß erscheint und dann zu Blau wechselt.\n\n
  Drücken Sie eine beliebige Taste, um zu beginnen.`;
  text(textLines, margin, 150, wrap);
}

function drawBreakScreen() {
  background(0);
  textSize(18);
  textAlign(LEFT, TOP);
  textWrap(WORD);
  const margin = 50;
  const wrap = width - 2 * margin;
  const textLines = `Sie haben ${currentSet} von ${totalSets} Blöcken abgeschlossen.\n\n
  Wenn Sie möchten, können Sie eine kurze Pause machen.\n\n
  Wenn Sie wieder bereit sind, drücken Sie eine beliebige Taste, um fortzufahren.`\n\n
  Zur Erinnerung: Reagieren Sie mit den Pfeiltasten auf die Richtung, in die der Pfeil zeigt.\n\n
  Drücken Sie keine Taste, wenn die Ellipse in Blau erscheint.
  Drücken Sie auch dann keine Taste, wenn die Ellipse zuerst in Weiß erscheint und dann zu Blau wechselt.\n\n
  Drücken Sie eine beliebige Taste, um zu beginnen.`;
  
  text(textLines, margin, 150, wrap);
}

function drawEndScreen() {
  background(0);
  textSize(18);
  textAlign(LEFT, TOP);
  textWrap(WORD);
  const margin = 50;
  const wrap = width - 2 * margin;
  const textLines = `Vielen Dank für Ihre Teilnahme an dieser Studie!\n\n 
    Wenden Sie sich nun an die Versuchsleitung.`;
  text(textLines, margin, 150, wrap);
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
  stroke(colorName === 'blue' ? color(0, 0, 255) : 255);
  ellipse(width / 2, height / 2, ellipseW, ellipseH);
}

function drawArrow(symbol, xOffset) {
  textSize(ARROW_PX);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  text(symbol, width / 2 + xOffset, height / 2);
}

function handleResponse() {
  if (!currentTrial) return;

  if (currentTrial.type === 'stop') {
    if (responded) ssd = Math.max(minSSD, ssd - ssdStep);
    else           ssd = Math.min(maxSSD, ssd + ssdStep);
  }

  // Übungsdaten NICHT speichern
  if (currentSet > 0) {
    fullData.push({
      set: currentSet,
      trial: setTrialIndex + 1,
      type: currentTrial.type,
      direction: currentTrial.direction,
      responded: responded,
      ellipseColor: ellipseShouldBeBlue ? 'blue' : 'white'
    });
  }
}

function downloadCSV() {
  let csv = "Set;Trial;Type;Direction;Responded;EllipseColor\n";
  fullData.forEach(d => {
    csv += `${d.set};${d.trial};${d.type};${d.direction};${d.responded};${d.ellipseColor}\n`;
  });

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

  window.startSecondExperiment = startSecondExperiment; // wird von Exp 1 aufgerufen
  window.setup = setup;       // p5 braucht globales setup()
  window.draw = draw;         // p5 braucht globales draw()
  window.keyPressed = keyPressed; // p5 ruft globales keyPressed() auf
})();




