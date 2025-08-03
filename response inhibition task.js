let fixationText = '+';
let arrowSymbol = { left: '←', right: '→' };
let arrowOffset = 100; // horizontal distance from center

let ellipseW = 400;
let ellipseH = 200;

let ssd = 0.220;
const ssdStep = 0.050;
const minSSD = 0.020;
const maxSSD = 0.900;

const trialsPerSet = 80;
const totalSets = 3;

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

function startSecondExperiment() {
  currentSet = 0;
  fullData = [];
  state = 'ISI';
}

function setup() {
  createCanvas(800, 600);
  textAlign(LEFT, TOP);
  textWrap(WORD);
  textLeading(30);
  frameRate(60);
  fill(255);
  state = 'intro';
}

function keyPressed() {
  if (state === 'intro') {
    startSet();
  } else if (state === 'break') {
    startSet();
  } else if (state === 'end') {
    // Do nothing
  } else if (state === 'stimulus' && !responded) {
    responded = true;
    handleResponse();
    state = 'interTrial';
    trialStartTime = millis();
  }
}

function generateTrials() {
  const proportions = {
    congruent_go: 0.625,
    incongruent_go: 0.125,
    nogo: 0.125,
    stop: 0.125,
  };

  let trialList = [];

  let n_congruent = Math.floor(trialsPerSet * proportions.congruent_go);
  let n_incongruent = Math.floor(trialsPerSet * proportions.incongruent_go);
  let n_nogo = Math.floor(trialsPerSet * proportions.nogo);
  let n_stop = trialsPerSet - n_congruent - n_incongruent - n_nogo;

  function addTrials(type, count) {
    for (let i = 0; i < count; i++) {
      let direction = random(['left', 'right']);
      trialList.push({ type, direction });
    }
  }

  addTrials('congruent_go', n_congruent);
  addTrials('incongruent_go', n_incongruent);
  addTrials('nogo', n_nogo);
  addTrials('stop', n_stop);

  return shuffle(trialList);
}

function startSet() {
  currentSet++;
  if (currentSet > totalSets) {
    state = 'end';
    downloadCSV(); // trigger automatic download
    return;
  }

  trialList = generateTrials();
  setTrialIndex = 0;
  currentTrial = trialList[setTrialIndex];
  isiDuration = max(0.2, randomGaussian(1.5, 0.372));
  state = 'ISI';
  trialStartTime = millis();
  responded = false;
  stopPresented = false;
  ellipseShouldBeBlue = false;
}

function draw() {
  background(0);
  fill(255);
  let elapsed = (millis() - trialStartTime) / 1000;

  if (state === 'intro') {
    drawIntro();
  } else if (state === 'break') {
    drawBreakScreen();
  } else if (state === 'ISI') {
    if (elapsed >= isiDuration) {
      state = 'fixation';
      trialStartTime = millis();
    }
  } else if (state === 'fixation') {
    drawEllipse('white');
    drawFixation();
    if (elapsed >= fixationDuration) {
      state = 'stimulus';
      trialStartTime = millis();
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
      trialStartTime = millis();
    }
  } else if (state === 'interTrial') {
    if (elapsed >= 0.5) {
      setTrialIndex++;
      if (setTrialIndex >= trialsPerSet) {
        if (currentSet < totalSets) {
          state = 'break';
        } else {
          state = 'end';
        }
      } else {
        currentTrial = trialList[setTrialIndex];
        isiDuration = max(0.2, randomGaussian(1.5, 0.372));
        state = 'ISI';
        trialStartTime = millis();
        responded = false;
        stopPresented = false;
        ellipseShouldBeBlue = false;
      }
    }
  } else if (state === 'end') {
    drawEndScreen();
  }
}

function drawBreakScreen() {
  background(0);
  textSize(18);
  textAlign(LEFT, TOP);
  textWrap(WORD);
  const margin = 50;
  const wrap = width - 2 * margin;
  const textLines = `Sie haben ${currentSet} von ${totalSets} Blöcken abgeschlossen. <br><br>
  Wenn Sie möchten, können Sie eine kurze Pause machen.<br><br>
  Wenn Sie bereit sind, weiter zu machen, drücken Sie eine beliebige Taste, um fortzufahren.`;
  text(textLines, margin, 150, wrap);
}

function drawEndScreen() {
  background(0);
  textSize(18);
  textAlign(LEFT, TOP);
  textWrap(WORD);
  const margin = 50;
  const wrap = width - 2 * margin;
  const textLines = `Vielen Dank für Ihre Teilnahme an dieser Studie! <br><br>
                    Wenden Sie sich nun an die Versuchsleitung.`;
  text(textLines, margin, 150, wrap);
}

function drawFixation() {
  textSize(40);
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
  textSize(60);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  text(symbol, width / 2 + xOffset, height / 2);
}

function handleResponse() {
  if (!currentTrial) return;

  if (currentTrial.type === 'stop') {
    if (responded) {
      ssd = max(minSSD, ssd - ssdStep);
    } else {
      ssd = min(maxSSD, ssd + ssdStep);
    }
  }

  fullData.push({
    set: currentSet,
    trial: setTrialIndex + 1,
    type: currentTrial.type,
    direction: currentTrial.direction,
    responded: responded,
    ellipseColor: ellipseShouldBeBlue ? 'blue' : 'white'
  });
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