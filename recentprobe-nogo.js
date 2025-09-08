const letters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","Y","Z"];
const trials = [];
const trialsPerBlock = 68;
const totalBlocks = 3;
let currentBlock = 1;
const goConditions = ["match-recent","match-nonrecent","nonmatch-recent","nonmatch-nonrecent"];
const conditionCounts = {"match-recent": 12, "match-nonrecent": 12, "nonmatch-recent": 12, "nonmatch-nonrecent": 12};
let goTrials = [];
let nogoCount = 20;

let allTrialConditions = [];
goConditions.forEach(c => {
    for (let i = 0; i < conditionCounts[c]; i++) allTrialConditions.push({condition: c, isNogo: false});
});
for (let i = 0; i < nogoCount; i++) allTrialConditions.push({condition: "nogo", isNogo: true});
shuffle(allTrialConditions);

let currentTrial = 0;
let memoryHistory = [];
let data = [];
let responseTimeout;
let responseGiven = false;

const stimulusDiv = document.getElementById("stimulus");
const downloadBtn = document.getElementById("download-btn");


const STIMULUS_PX = 48;  // Größe für Trials (wie im ersten Durchgang)
const UI_TEXT_PX  = 20;  // Größe für Instruktionen/Break-Screens


const practiceTrials = 10;
let inPractice = true;
const usedPracticeSets = new Set();

function setStimulusTextSize(px) {
  stimulusDiv.style.fontSize = px + "px";
  stimulusDiv.style.lineHeight = "1";
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function pickRandomLetters(exclude, count) {
    let pool = letters.filter(l => !exclude.includes(l));
    shuffle(pool);
    return pool.slice(0, count);
}

function poolExcluding(exclusions) {
  const ex = new Set(exclusions);
  return letters.filter(l => !ex.has(l));
}

function sampleK(arr, k) {
  const a = arr.slice();
  shuffle(a);
  return a.slice(0, k);
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
    responseGiven = false;

    function handleResponse(e) {
        if (responseGiven) return;
        responseGiven = true;
        const rt = Date.now() - start;
        let correct = false;
        let error = false;

        document.removeEventListener("keydown", handleResponse);
        clearTimeout(responseTimeout);

        const trial = trials[currentTrial];

        if (probe === "X") {
            correct = false;
            error = true;
        } else {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                correct = ((trial.condition.startsWith("match") && e.key === "ArrowRight") ||
                           (trial.condition.startsWith("nonmatch") && e.key === "ArrowLeft"));
                error = !correct;
            } else {
                error = true;
            }
        }

        if (error) {
            stimulusDiv.innerHTML = `${probe}<br><span style="color:red">!</span>`;
        }

        // Übungsdaten NICHT speichern
        if (!inPractice) {
          data.push({
              trial: currentTrial+1,
              condition: trial.condition,
              isNogo: trial.isNogo,
              probe: probe,
              response: e.key,
              correct: correct,
              rt: rt
          });
        }

        setTimeout(nextTrial, 500);
    }

    document.addEventListener("keydown", handleResponse);
    responseTimeout = setTimeout(() => {
        document.removeEventListener("keydown", handleResponse);
        if (!responseGiven) {
            // Übungsdaten NICHT speichern
            if (!inPractice) {
              data.push({
                  trial: currentTrial+1,
                  condition: trials[currentTrial].condition,
                  isNogo: trials[currentTrial].isNogo,
                  probe: probe,
                  response: "none",
                  correct: probe === "X",
                  rt: "none"
              });
            }
            nextTrial();
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
        Wenn Sie wieder bereit sind, drücken Sie eine beliebige Taste, um mit Block ${currentBlock + 1} fortzufahren.`;

    document.addEventListener("keydown", function breakHandler(e) {
        document.removeEventListener("keydown", breakHandler);
        currentBlock++;
        currentTrial = 0;
        shuffle(allTrialConditions);
        setStimulusTextSize(STIMULUS_PX);
        runTrial();
    });
}

function showPracticeEndScreen_Exp1() {
    setStimulusTextSize(UI_TEXT_PX);
    stimulusDiv.innerHTML = `Die Übungsdurchgänge sind beendet .<br><br>
        <strong>Jetzt startet der erste richtige Durchgang von Experiment 1.</strong><br><br>
        Reagieren Sie weiterhin so schnell und genau wie möglich.<br><br>
        <em>Drücken Sie eine beliebige Taste, um zu beginnen.</em>`;
    document.addEventListener("keydown", function practiceEndHandler(e) {
        document.removeEventListener("keydown", practiceEndHandler);
        inPractice = false;
        currentTrial = 0;
        shuffle(allTrialConditions);       // frische Reihenfolge für Test
        setStimulusTextSize(STIMULUS_PX);
        runTrial();
    });
}

function runTrial() {
  const trialInfo = allTrialConditions[currentTrial];

  function buildOnce() {
    let memorySet, probe;

    if (trialInfo.isNogo) {
      memorySet = pickRandomLetters(["X"], 6);
      probe = "X";
      return { memorySet, probe };
    }

    const lastSet   = memoryHistory.length ? memoryHistory[memoryHistory.length - 1] : [];
    const recent3   = memoryHistory.slice(-3).flat();

    switch (trialInfo.condition) {
      case "match-recent": {
        if (lastSet.length) {
          // 1 Buchstabe teilen, Rest NICHT aus dem letzten Set
          const shared = lastSet[Math.floor(Math.random() * lastSet.length)];
          let pool = poolExcluding(["X", ...lastSet.filter(l => l !== shared)]);
          if (pool.length < 5) {
            // Fallback: nur "X" und shared verbieten
            pool = poolExcluding(["X", shared]);
          }
          const others = sampleK(pool, 5);
          memorySet = others.concat(shared);
          shuffle(memorySet);
          probe = shared;
        } else {
          memorySet = pickRandomLetters(["X"], 6);
          probe = memorySet[Math.floor(Math.random() * memorySet.length)];
        }
        break;
      }

      case "match-nonrecent": {
        // Probe nicht aus den letzten 3 Sets
        const eligibleProbe = poolExcluding(["X", ...recent3]);
        if (eligibleProbe.length > 0) {
          const probeMN = eligibleProbe[Math.floor(Math.random() * eligibleProbe.length)];
          // Versuche auch die anderen 5 NICHT aus recent3 zu ziehen
          let pool = poolExcluding(["X", probeMN, ...recent3]);
          if (pool.length < 5) {
            // Fallback: recent-Constraint für die anderen lockern
            pool = poolExcluding(["X", probeMN]);
          }
          const base = sampleK(pool, 5);
          memorySet = base.concat(probeMN);
          shuffle(memorySet);
          probe = probeMN;
        } else {
          // harter Fallback
          memorySet = pickRandomLetters(["X"], 6);
          probe = memorySet[Math.floor(Math.random() * memorySet.length)];
        }
        break;
      }

      case "nonmatch-recent": {
        if (lastSet.length) {
          // Probe aus dem letzten Set
          const candidates = lastSet.filter(l => l !== "X");
          const probeCandidate = candidates[Math.floor(Math.random() * candidates.length)];
          // Set-Buchstaben NICHT aus dem letzten Set (und ≠ Probe)
          let pool = poolExcluding(["X", ...lastSet, probeCandidate]);
          if (pool.length < 6) {
            // Fallback: nur "X" und Probe verbieten
            pool = poolExcluding(["X", probeCandidate]);
          }
          memorySet = sampleK(pool, 6);
          // Sicherheit: Nonmatch garantieren
          if (memorySet.includes(probeCandidate)) {
            // ersetze den einen Treffer
            let replPool = poolExcluding([...memorySet, "X", probeCandidate]);
            if (replPool.length > 0) {
              const idx = memorySet.indexOf(probeCandidate);
              memorySet[idx] = replPool[Math.floor(Math.random() * replPool.length)];
            }
          }
          probe = probeCandidate;
        } else {
          memorySet = pickRandomLetters(["X"], 6);
          // Nonmatch: nimm eine Probe, die nicht im Set ist
          const probePool = poolExcluding(["X", ...memorySet]);
          probe = probePool[Math.floor(Math.random() * probePool.length)];
        }
        break;
      }

      case "nonmatch-nonrecent": {
        // Set-Buchstaben NICHT aus den letzten 3 Sets
        let pool = poolExcluding(["X", ...recent3]);
        if (pool.length < 6) {
          // Fallback: nur X verbieten
          pool = poolExcluding(["X"]);
        }
        memorySet = sampleK(pool, 6);

        // Probe NICHT im Set und NICHT in recent3
        let probePool = poolExcluding(["X", ...memorySet, ...recent3]);
        if (probePool.length === 0) {
          // Fallback: nur nicht im Set
          probePool = poolExcluding(["X", ...memorySet]);
        }
        probe = probePool[Math.floor(Math.random() * probePool.length)];
        break;
      }
    }

    // Fallbacks
    if (!memorySet) memorySet = pickRandomLetters(["X"], 6);
    if (!probe)     probe     = memorySet[Math.floor(Math.random() * memorySet.length)];
    return { memorySet, probe };
  }


  let { memorySet, probe } = buildOnce();
  if (typeof usedPracticeSets !== 'undefined' && inPractice) {
    let key = memorySet.join("-");
    let guardPractice = 0;
    while (usedPracticeSets.has(key) && guardPractice < 30) {
      ({ memorySet, probe } = buildOnce());
      key = memorySet.join("-");
      guardPractice++;
    }
    usedPracticeSets.add(key);
  }

  trials.push({ condition: trialInfo.condition, isNogo: trialInfo.isNogo, memorySet, probe });
  memoryHistory.push(memorySet);
  if (memoryHistory.length > 3) memoryHistory.shift();

  // Anzeige
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
    document.addEventListener("keydown", function secondExpIntroHandler(e) {
        document.removeEventListener("keydown", secondExpIntroHandler);
        startSecondExperimentInstructions();
    });
}

function downloadCSV() {
    let csv = "trial;condition;isNogo;probe;response;correct;rt\n";
    data.forEach(d => {
        csv += `${d.trial};${d.condition};${d.isNogo};${d.probe};${d.response};${d.correct};${d.rt}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "experiment1_data.csv";
    a.click();
    URL.revokeObjectURL(url);
}

downloadBtn.addEventListener("click", downloadCSV);

// Erste Startfolie: Begrüßung 
function showWelcomeScreen() {
    setStimulusTextSize(UI_TEXT_PX);
    stimulusDiv.innerHTML = `Hallo! Vielen Dank für die Teilnahme an dieser Studie. <br><br>
        Sie werden zwei verschiedene Experimente bearbeiten. <br><br>
        Jedes Experiment umfasst drei Testblöcke. Nach jedem Block können Sie eine kurze Pause machen.<br><br>
        Vor dem jeweils ersten Testblock gibt es einen kurzen Übungsblock, um sich an die Aufgabe zu gewöhnen.<br><br>
        <em>Drücken Sie eine beliebige Taste, um mit den Instruktionen für Experiment 1 fortzufahren.</em>`;
    document.addEventListener("keydown", welcomeHandler);
}

function welcomeHandler(e) {
    document.removeEventListener("keydown", welcomeHandler);
    showInstructions();
}

// Zweite Startfolie: Instruktionen Experiment 1
function showInstructions() {
    setStimulusTextSize(UI_TEXT_PX);
    stimulusDiv.innerHTML = `Experiment 1 <br><br>
        Zu Beginn jedes Durchgangs erscheint ein Fixationskreuz in der Mitte des Bildschirms. Bitte schauen Sie darauf.<br><br>
        Anschließend erscheinen sechs Buchstaben, merken Sie sich diese so gut wie möglich.<br><br>
        Als nächstes erscheint ein einzelner Buchstabe in der Mitte des Bildschirms. 
        Ihre Aufgabe ist es, zu entscheiden, ob dieser Buchstabe Teil des vorherigen Buchstabensatzes war:<br><br>
        Wenn ja, drücken Sie die rechte Pfeiltaste (→)<br>
        Wenn nein, drücken Sie die linke Pfeiltaste (←)<br><br>
        In manchen Durchgängen erscheint ein „X“.  Wenn das der Fall ist, dürfen Sie keine Taste drücken.<br><br>
        Wenn Sie einen Fehler machen, erscheint ein rotes Ausrufezeichen (!) auf dem Bildschirm.<br><br>
        Versuchen Sie immer, so schnell und genau wie möglich zu reagieren.<br><br>
        <em>Drücken Sie eine beliebige Taste, um mit den Übungsdurchgängen zu starten.</em>`;
    document.addEventListener("keydown", instructionHandler);
}

function instructionHandler(e) {
    document.removeEventListener("keydown", instructionHandler);
    setStimulusTextSize(STIMULUS_PX);
    // startet mit Übungsphase (inPractice = true)
    runTrial();
}

// Starte mit der Willkommensfolie
showWelcomeScreen();

// Experiment 2
function startSecondExperimentInstructions() {
    downloadBtn.style.display = "none";
    setStimulusTextSize(UI_TEXT_PX);
    stimulusDiv.innerHTML = `Experiment 2<br><br>
    Zu Beginn jedes Durchgangs erscheint ein Fixationskreuz innerhalb einer Ellipse. Bitte schauen Sie darauf.<br><br>
    Als nächstes erscheint rechts oder links von dem Fixationskreuz ein Pfeil.
    Reagieren Sie mit den Pfeiltasten, auf die Richtung, in die der Pfeil zeigt. <br><br>
    In manchen Durchgängen erscheint die Ellipse in Blau. Dann dürfen Sie keine Taste drücken. <br><br>
    In manchen Durchgängen erscheint die Ellipse zuerst in weiß und wechselt dann zu blau. Auch dann dürfen Sie keine Taste drücken.<br><br>
    Versuchen Sie immer, so schnell und genau wie möglich zu reagieren.<br><br>
    <em>Drücken Sie eine beliebige Taste, um mit den Übungsdurchgängen zu starten.</em>`;
    document.addEventListener("keydown", secondExpStartHandler);
}

function secondExpStartHandler(e) {
    document.removeEventListener("keydown", secondExpStartHandler);
    stimulusDiv.style.display = "none";
    startSecondExperiment();
}

