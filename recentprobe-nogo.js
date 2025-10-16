const letters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","Y","Z"];
const trials = [];
const trialsPerBlock = 68;
const totalBlocks = 3;
let currentBlock = 1;

const __urlParams = new URLSearchParams(window.location.search);
const participantId = __urlParams.get('REDCapID') || __urlParams.get('record_id') || __urlParams.get('rid') || "";

const goConditions = ["match-recent","match-nonrecent","nonmatch-recent","nonmatch-nonrecent"];
const conditionCounts = {"match-recent": 12, "match-nonrecent": 12, "nonmatch-recent": 12, "nonmatch-nonrecent": 12};
let nogoCount = 20;

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req) {
    try {
      req.call(el, { navigationUI: "hide" });
    } catch (e) {
      req.call(el);
    }
  }
}

function ensureNoConsecutiveNogo(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].isNogo && arr[i - 1].isNogo) {
      // suche das nächste Go-Trial und tausche
      let j = i + 1;
      while (j < arr.length && arr[j].isNogo) j++;
      if (j < arr.length) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
  }
  return arr;
}

let allTrialConditions = [];
goConditions.forEach(c => {
  for (let i = 0; i < conditionCounts[c]; i++) allTrialConditions.push({condition: c, isNogo: false});
});
for (let i = 0; i < nogoCount; i++) allTrialConditions.push({condition: "nogo", isNogo: true});
shuffleInPlace(allTrialConditions);
ensureNoConsecutiveNogo(allTrialConditions);

let currentTrial = 0;
let memoryHistory = [];
let data = [];
let responseTimeout;
let responseGiven = false;

const stimulusDiv = document.getElementById("stimulus");
const downloadBtn = document.getElementById("download-btn");

const STIMULUS_PX = 48;
const UI_TEXT_PX  = 20;

const pad = n => String(n).padStart(2,'0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

let expStartMs = null;
let expDateStr = null;
let expStartTimeStr = null;

let instructionPages = [
  `Experiment 1 <br><br>
   Willkommen zum ersten Experiment. Drücken Sie eine beliebige Taste, um sich durch die Instruktionen zu klicken.`,
  `Zu Beginn jedes Durchgangs erscheint ein Fixationskreuz in der Mitte des Bildschirms. Bitte schauen Sie darauf.`,
  `Anschließend erscheinen wie auf dem Beispielbild sechs Buchstaben. Merken Sie sich diese so gut wie möglich.<br><br>
    <img src="memoryset.png" style="max-width:400px; display:block; margin:auto;">`,
  `Als nächstes erscheint ein einzelner Buchstabe.<br><br>
  Ihre Aufgabe ist es, zu entscheiden, ob dieser Buchstabe Teil der vorherigen sechs Buchstaben war:<br><br>
   Wenn ja, drücken Sie die rechte Pfeiltaste (→)<br>
   Wenn nein, drücken Sie die linke Pfeiltaste (←)`,
  `In manchen Durchgängen erscheint ein „X“. Dann dürfen Sie keine Taste drücken.`,
  `Wenn Sie einen Fehler machen, erscheint ein rotes Ausrufezeichen (!) auf dem Bildschirm.<br><br>
   Versuchen Sie immer, so schnell und genau wie möglich zu reagieren.<br><br>
   <em>Drücken Sie eine beliebige Taste, um den Übungsblock zu starten.</em>`
];
let currentInstructionPage = 0;

let secondInstructionPages = [
  `Experiment 2<br><br>
   Willkommen zum zweiten Experiment. Drücken Sie eine beliebige Taste, um sich durch die Instruktionen zu klicken.`,
  `Zu Beginn jedes Durchgangs erscheint ein Fixationskreuz innerhalb einer Ellipse. Bitte schauen Sie darauf.`,
  `Als nächstes erscheint rechts oder links vom Fixationskreuz ein Pfeil.<br>
   Reagieren Sie mit den Pfeiltasten auf die Richtung, in die der Pfeil zeigt.<br><br>
   <img src="ellipseweiss.png" style="max-width:400px; display:block; margin:auto;">`,
  `In manchen Durchgängen erscheint die Ellipse in Blau. Dann dürfen Sie keine Taste drücken.<br><br>
   <img src="ellipseblau.png" style="max-width:400px; display:block; margin:auto;">`,
  `In manchen Durchgängen erscheint die Ellipse zuerst in Weiß und wechselt dann zu Blau. Auch dann dürfen Sie keine Taste drücken.`,
  `Wenn Sie einen Fehler machen, erscheint ein rotes Ausrufezeichen (!) auf dem Bildschirm.<br><br>
   Versuchen Sie immer, so schnell und genau wie möglich zu reagieren.<br><br>
   <em>Drücken Sie eine beliebige Taste, um den Übungsblock zu starten.</em>`
];
let currentSecondInstructionPage = 0;

const practiceTrials = 20;
let inPractice = true;
const usedPracticeSets = new Set();

function setStimulusTextSize(px) {
  stimulusDiv.style.fontSize = px + "px";
  stimulusDiv.style.lineHeight = "1";
}

function pickRandomLetters(exclude, count) {
  let pool = letters.filter(l => !exclude.includes(l));
  shuffleInPlace(pool);
  return pool.slice(0, count);
}

function getNonRecentLetter(history) {
  const recentLetters = history.slice(-3).flat();
  return pickRandomLetters(["X", ...recentLetters], 1)[0];
}

function displayFixation(duration, callback) {
  stimulusDiv.textContent = "+";
  setTimeout(callback, duration);
}

function displayMemorySet(letters, duration, callback) {
  stimulusDiv.innerHTML = `${letters.slice(0,3).join("&nbsp;&nbsp;")}<br>+<br>${letters.slice(3).join("&nbsp;&nbsp;")}`;
  setTimeout(callback, duration);
}

function displayProbe(probe) {
  stimulusDiv.textContent = probe;
  const start = Date.now();
  let responseGiven = false;

  function handleResponse(e) {
    if (responseGiven) return;
    responseGiven = true;

    const rt = Date.now() - start;

    document.removeEventListener("keydown", handleResponse);
    clearTimeout(responseTimeout);

    const trial = trials[trials.length - 1];
    const memSetStr = trial && trial.memorySet ? trial.memorySet.join("") : "";

    let correct = false;
    let error = false;

    if (probe === "X") {
      correct = false;
      error = true;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const isMatch = trial.condition.startsWith("match");
      correct = (isMatch && e.key === "ArrowRight") || (!isMatch && e.key === "ArrowLeft");
      error = !correct;
    } else {
      correct = false;
      error = true;
    }

    if (!inPractice) {
      data.push({
        trial: currentTrial + 1,
        condition: trial.condition,
        isNogo: trial.isNogo,
        probe: probe,
        response: e.key || "none",
        correct: correct,
        rt: rt,
        memorySet: memSetStr
      });
    }

    if (inPractice && error) {
      stimulusDiv.innerHTML = `${probe}<br><span style="color:red">!</span><br>
        <div style="margin-top:10px; font-size:16px; color:black;">
          Zur Erinnerung:<br>
          einzelner Buchstabe war Teil der sechs Buchstaben: → rechte Pfeiltaste <br>
          einzelner Buchstabe war nicht Teil der sechs Buchstaben: ← linke Pfeiltaste <br>
          „X“ erscheint: keine Taste drücken
        </div>`;
      setTimeout(nextTrial, 6000);
    } else if (!inPractice && error) {
      stimulusDiv.innerHTML = `${probe}<br><span style="color:red">!</span>`;
      setTimeout(nextTrial, 500);
    } else {
      stimulusDiv.textContent = "";
      nextTrial();
    }
  }

  document.addEventListener("keydown", handleResponse);

  responseTimeout = setTimeout(() => {
    document.removeEventListener("keydown", handleResponse);
    if (!responseGiven) {
      const trial = trials[trials.length - 1];
      const memSetStr = trial && trial.memorySet ? trial.memorySet.join("") : "";

      const wasCorrectNoGo = (probe === "X");
      const isErrorMiss   = !wasCorrectNoGo;

      if (!inPractice) {
        data.push({
          trial: currentTrial + 1,
          condition: trial.condition,
          isNogo: trial.isNogo,
          probe: probe,
          response: "none",
          correct: wasCorrectNoGo,
          rt: "none",
          memorySet: memSetStr
        });
      }

      if (inPractice && isErrorMiss) {
        stimulusDiv.innerHTML = `${probe}<br><span style="color:red">!</span><br>
          <div style="margin-top:10px; font-size:16px; color:black;">
            Zur Erinnerung:<br>
             einzelner Buchstabe war Teil der sechs Buchstaben: → rechte Pfeiltaste <br>
             einzelner Buchstabe war nicht Teil der sechs Buchstaben: ← linke Pfeiltaste <br>
            „X“ erscheint: keine Taste drücken
          </div>`;
        setTimeout(nextTrial, 6000);
      } else if (!inPractice && isErrorMiss) {
        stimulusDiv.innerHTML = `${probe}<br><span style="color:red">!</span>`;
        setTimeout(nextTrial, 500);
      } else {
        stimulusDiv.textContent = "";
        nextTrial();
      }
    }
  }, 2000);
}

function nextTrial() {
  currentTrial++;

  if (inPractice) {
    if (currentTrial >= practiceTrials) {
      showPracticeEndScreen_Exp1();
      return;
    }
  } else {
    if (currentTrial >= trialsPerBlock) {
      if (currentBlock < totalBlocks) {
        showBreakScreen();
      } else {
        endExperiment();
      }
      return;
    }
  }

  runTrial();
}

function showBreakScreen() {
  setStimulusTextSize(UI_TEXT_PX);
  stimulusDiv.innerHTML = `Block ${currentBlock} ist abgeschlossen.<br><br>
      Wenn Sie möchten, können Sie eine kurze Pause machen.<br><br>
      Wenn Sie wieder bereit sind, drücken Sie eine beliebige Taste, um mit Block ${currentBlock + 1} fortzufahren. <br><br>
      Zur Erinnerung: Ihre Aufgabe ist es, zu entscheiden, ob der einzelne Buchstabe Teil der vorherigen sechs Buchstaben war:<br><br>
   Wenn ja, drücken Sie die rechte Pfeiltaste (→)<br>
   Wenn nein, drücken Sie die linke Pfeiltaste (←)<br>
   Drücken Sie keine Taste, wenn ein "X" erscheint.`;

  document.addEventListener("keydown", function breakHandler() {
    document.removeEventListener("keydown", breakHandler);
    currentBlock++;
    currentTrial = 0;
    trials.length = 0;
    shuffleInPlace(allTrialConditions);
    // === NEU: nach Re-Shuffle absichern ===
    ensureNoConsecutiveNogo(allTrialConditions);
    setStimulusTextSize(STIMULUS_PX);
    runTrial();
  });
}

function showPracticeEndScreen_Exp1() {
  setStimulusTextSize(UI_TEXT_PX);
  stimulusDiv.innerHTML = `Der Übunbgsblock ist beendet.<br><br>
      <strong>Jetzt startet der erste richtige Durchgang von Experiment 1.</strong><br><br>
      Zur Erinnerung: Ihre Aufgabe ist es, zu entscheiden, ob der einzelne Buchstabe Teil der vorherigen sechs Buchstaben war:<br><br>
   Wenn ja, drücken Sie die rechte Pfeiltaste (→)<br>
   Wenn nein, drücken Sie die linke Pfeiltaste (←)<br>
   Drücken Sie keine Taste, wenn ein "X" erscheint.<br><br>
      <em>Drücken Sie eine beliebige Taste, um zu beginnen.</em>`;

  document.addEventListener("keydown", function practiceEndHandler() {
    document.removeEventListener("keydown", practiceEndHandler);
    inPractice = false;
    currentTrial = 0;
    trials.length = 0;
    usedPracticeSets.clear();
    shuffleInPlace(allTrialConditions);
    // === NEU: nach Re-Shuffle absichern ===
    ensureNoConsecutiveNogo(allTrialConditions);
    setStimulusTextSize(STIMULUS_PX);
    runTrial();
  });
}

function runTrial() {
  if (currentTrial > 0) {
    const prev = allTrialConditions[currentTrial - 1];
    const curr = allTrialConditions[currentTrial];
    if (prev?.isNogo && curr?.isNogo) {
      let k = currentTrial + 1;
      while (k < allTrialConditions.length && allTrialConditions[k].isNogo) k++;
      if (k < allTrialConditions.length) {
        [allTrialConditions[currentTrial], allTrialConditions[k]] =
          [allTrialConditions[k], allTrialConditions[currentTrial]];
      }
    }
  }

  const trialInfo = allTrialConditions[currentTrial];
  if (expStartMs === null) {
    const start = new Date();
    expStartMs = start.getTime();
    expDateStr = fmtDate(start);
    expStartTimeStr = fmtTime(start);
  }
  let memorySet;
  let probe;

  if (trialInfo.isNogo) {
    memorySet = pickRandomLetters(["X"], 6);
    probe = "X";
  } else {
    switch (trialInfo.condition) {
      case "match-recent":
        if (memoryHistory.length > 0) {
          const lastSet = memoryHistory[memoryHistory.length - 1];
          const shared = lastSet[Math.floor(Math.random() * lastSet.length)];
          memorySet = pickRandomLetters(["X", shared], 5);
          memorySet.push(shared);
          shuffleInPlace(memorySet);
          probe = shared;
        } else {
          memorySet = pickRandomLetters(["X"], 6);
          probe = memorySet[Math.floor(Math.random() * memorySet.length)];
        }
        break;

      case "match-nonrecent": {
        const recentMN = memoryHistory.slice(-3).flat();
        const eligibleMN = letters.filter(l => !recentMN.includes(l) && l !== "X");
        if (eligibleMN.length > 0) {
          const probeMN = eligibleMN[Math.floor(Math.random() * eligibleMN.length)];
          const baseSet = pickRandomLetters(["X", probeMN], 5);
          memorySet = [...baseSet, probeMN];
          shuffleInPlace(memorySet);
          probe = probeMN;
        } else {
          memorySet = pickRandomLetters(["X"], 6);
          probe = memorySet[Math.floor(Math.random() * memorySet.length)];
        }
        break;
      }

      case "nonmatch-recent":
        if (memoryHistory.length > 0) {
          const lastSet = memoryHistory[memoryHistory.length - 1];
          const candidates = lastSet.filter(l => l !== "X");
          shuffleInPlace(candidates);
          let found = false;
          for (let i = 0; i < candidates.length; i++) {
            const probeCandidate = candidates[i];
            const tempSet = pickRandomLetters(["X", probeCandidate], 6);
            if (!tempSet.includes(probeCandidate)) {
              memorySet = tempSet;
              probe = probeCandidate;
              found = true;
              break;
            }
          }
          if (!found) {
            memorySet = pickRandomLetters(["X"], 6);
            probe = memorySet[Math.floor(Math.random() * memorySet.length)];
          }
        } else {
          memorySet = pickRandomLetters(["X"], 6);
          probe = memorySet[Math.floor(Math.random() * memorySet.length)];
        }
        break;

      case "nonmatch-nonrecent": {
        const recentNMN = memoryHistory.slice(-3).flat();
        memorySet = pickRandomLetters(["X", ...recentNMN], 6);
        const probeCandidates = letters.filter(
          l => !memorySet.includes(l) && !recentNMN.includes(l) && l !== "X"
        );
        if (probeCandidates.length > 0) {
          probe = probeCandidates[Math.floor(Math.random() * probeCandidates.length)];
        } else {
          probe = getNonRecentLetter(memoryHistory.concat([memorySet]));
        }
        break;
      }
    }
  }

  if (!memorySet) {
    console.warn("memorySet war leer – Default gezogen");
    memorySet = pickRandomLetters(["X"], 6);
  }
  if (!probe) {
    console.warn("probe war leer – Default gezogen");
    probe = memorySet[Math.floor(Math.random() * memorySet.length)];
  }

  if (inPractice) {
    let key = memorySet.join("-");
    let guard = 0;
    while (usedPracticeSets.has(key) && guard < 30) {
      // komplett neues (anderes) Set erzwingen
      memorySet = pickRandomLetters(["X"], 6);
      if (trialInfo.isNogo) {
        probe = "X";
      } else if (trialInfo.condition.startsWith("match")) {
        probe = memorySet[Math.floor(Math.random() * memorySet.length)];
      } else {
        const candidates = letters.filter(l => l !== "X" && !memorySet.includes(l));
        probe = candidates.length
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : getNonRecentLetter(memoryHistory.concat([memorySet]));
      }
      key = memorySet.join("-");
      guard++;
    }
    usedPracticeSets.add(key);
  }

  trials.push({condition: trialInfo.condition, isNogo: trialInfo.isNogo, memorySet, probe});
  memoryHistory.push(memorySet);
  if (memoryHistory.length > 3) memoryHistory.shift();

  setStimulusTextSize(STIMULUS_PX);

  displayFixation(1500, () => {
    displayMemorySet(memorySet, 2000, () => {
      displayFixation(3000, () => {
        displayProbe(probe);
      });
    });
  });
}

function endExperiment() {
  setStimulusTextSize(UI_TEXT_PX);
  stimulusDiv.innerHTML = "Experiment 1 ist nun beendet! <br><br> Sie können nun eine kurze Pause machen, bevor Sie mit Experiment 2 beginnen. <br><br> Wenn Sie bereit sind, drücken Sie eine beliebige Taste, um mit den Instruktionen für Experiment 2 zu beginnen.";
  downloadCSV();
  document.addEventListener("keydown", function secondExpIntroHandler() {
    document.removeEventListener("keydown", secondExpIntroHandler);
    startSecondExperimentInstructions();
  });
}

function downloadCSV() {
  const end = new Date();
  const totalMs = (expStartMs != null) ? (end.getTime() - expStartMs) : "";

  const lines = [];
  lines.push(`#${expDateStr || ""};${expStartTimeStr || ""};${totalMs}`);
  lines.push("recordId;trial;condition;isNogo;probe;response;correct;rt;memorySet");

  data.forEach(d => {
    lines.push([
      participantId,
      d.trial,
      d.condition,
      d.isNogo,
      d.probe,
      d.response,
      d.correct,
      d.rt,
      d.memorySet || ""
    ].join(";"));
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "experiment1_data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function showWelcomeScreen() {
  setStimulusTextSize(UI_TEXT_PX);
  stimulusDiv.innerHTML = `Hallo! Vielen Dank für die Teilnahme an dieser Studie. <br><br>
      Sie werden zwei verschiedene Experimente bearbeiten. <br><br>
      Jedes Experiment umfasst drei Testblöcke. Nach jedem Block können Sie eine kurze Pause machen.<br><br>
      Vor dem jeweils ersten Testblock gibt es einen kurzen Übungsblock, um sich an die Aufgabe zu gewöhnen.<br><br>
      <em>Drücken Sie eine beliebige Taste, um mit den Instruktionen für Experiment 1 fortzufahren.</em>`;
  
  document.addEventListener("keydown", function welcomeHandler() {
    // Remove the listener to avoid multiple triggers
    document.removeEventListener("keydown", welcomeHandler);  
    
    enterFullscreen();  
    
    showInstructions();
  });
}

function showInstructions() {
  setStimulusTextSize(UI_TEXT_PX);
  stimulusDiv.innerHTML = instructionPages[currentInstructionPage];
  document.addEventListener("keydown", instructionPageHandler);
}

function instructionPageHandler() {
  document.removeEventListener("keydown", instructionPageHandler);
  currentInstructionPage++;

  if (currentInstructionPage < instructionPages.length) {
    showInstructions();
  } else {
    currentInstructionPage = 0;
    setStimulusTextSize(STIMULUS_PX);
    runTrial();
  }
}

showWelcomeScreen();

function startSecondExperimentInstructions() {
  downloadBtn.style.display = "none";
  setStimulusTextSize(UI_TEXT_PX);
  currentSecondInstructionPage = 0;
  stimulusDiv.style.display = "";
  stimulusDiv.innerHTML = secondInstructionPages[currentSecondInstructionPage];

  document.addEventListener("keydown", secondInstructionPageHandler);
}

function secondInstructionPageHandler() {
  document.removeEventListener("keydown", secondInstructionPageHandler);
  currentSecondInstructionPage++;

  if (currentSecondInstructionPage < secondInstructionPages.length) {
    setStimulusTextSize(UI_TEXT_PX);
    stimulusDiv.innerHTML = secondInstructionPages[currentSecondInstructionPage];
    document.addEventListener("keydown", secondInstructionPageHandler);
  } else {
    currentSecondInstructionPage = 0;
    stimulusDiv.style.display = "none";
    startSecondExperiment();
  }
}





