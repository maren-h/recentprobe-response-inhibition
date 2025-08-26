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

// === Einheitliche Textgrößen zentral festlegen ===
const STIMULUS_PX = 48;  // Größe für Trials (wie im ersten Durchgang)
const UI_TEXT_PX  = 20;  // Größe für Instruktionen/Break-Screens

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

        data.push({
            trial: currentTrial+1,
            condition: trial.condition,
            isNogo: trial.isNogo,
            probe: probe,
            response: e.key,
            correct: correct,
            rt: rt
        });

        setTimeout(nextTrial, 500);
    }

    document.addEventListener("keydown", handleResponse);
    responseTimeout = setTimeout(() => {
        document.removeEventListener("keydown", handleResponse);
        if (!responseGiven) {
            data.push({
                trial: currentTrial+1,
                condition: trials[currentTrial].condition,
                isNogo: trials[currentTrial].isNogo,
                probe: probe,
                response: "none",
                correct: probe === "X",
                rt: "none"
            });
            nextTrial();
        }
    }, 2000);
}

function nextTrial() {
    currentTrial++;

    if (currentTrial >= trialsPerBlock) {
        if (currentBlock < totalBlocks) {
            showBreakScreen();
        } else {
            endExperiment();
        }
        return;
    }

    runTrial();
}

function showBreakScreen() {
    setStimulusTextSize(UI_TEXT_PX);
    stimulusDiv.innerHTML = `Block ${currentBlock} ist abgeschlossen.<br><br>
        Wenn Sie möchten, können Sie eine kurze Pause machen.<br><br>
        Wenn Sie bereit sind, weiter zu machen, drücken Sie eine beliebige Taste, um mit Block ${currentBlock + 1} fortzufahren.`;

    document.addEventListener("keydown", function breakHandler(e) {
        document.removeEventListener("keydown", breakHandler);
        currentBlock++;
        currentTrial = 0;
        shuffle(allTrialConditions);
        setStimulusTextSize(STIMULUS_PX);
        runTrial();
    });
}

function runTrial() {
    const trialInfo = allTrialConditions[currentTrial];
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
                    shuffle(memorySet);
                    probe = shared;
                } else {
                    memorySet = pickRandomLetters(["X"], 6);
                    probe = memorySet[Math.floor(Math.random() * memorySet.length)];
                }
                break;

            case "match-nonrecent":
                const recentMN = memoryHistory.slice(-3).flat();
                const eligibleMN = letters.filter(l => !recentMN.includes(l) && l !== "X");
                if (eligibleMN.length > 0) {
                    const probeMN = eligibleMN[Math.floor(Math.random() * eligibleMN.length)];
                    const baseSet = pickRandomLetters(["X", probeMN], 5);
                    memorySet = [...baseSet, probeMN];
                    shuffle(memorySet);
                    probe = probeMN;
                } else {
                    memorySet = pickRandomLetters(["X"], 6);
                    probe = memorySet[Math.floor(Math.random() * memorySet.length)];
                }
                break;

            case "nonmatch-recent":
                if (memoryHistory.length > 0) {
                    const lastSet = memoryHistory[memoryHistory.length - 1];
                    const candidates = lastSet.filter(l => l !== "X");
                    shuffle(candidates);
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

            case "nonmatch-nonrecent":
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

    // Sicherheits-Fallback
    if (!memorySet) {
        console.warn("memorySet war leer – Default gezogen");
        memorySet = pickRandomLetters(["X"], 6);
    }
    if (!probe) {
        console.warn("probe war leer – Default gezogen");
        probe = memorySet[Math.floor(Math.random() * memorySet.length)];
    }

    trials.push({condition: trialInfo.condition, isNogo: trialInfo.isNogo, memorySet, probe});
    memoryHistory.push(memorySet);
    if (memoryHistory.length > 3) memoryHistory.shift();

    console.log("Trial:", currentTrial, "MemorySet:", memorySet, "Probe:", probe);

    // Trials starten IMMER mit fester Stimulusgröße
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
    setTimeout(() => {
      startSecondExperiment(); 
    }, 1000);
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
        <em>Drücken Sie eine beliebige Taste, um das Experiment zu starten.</em>`;
    document.addEventListener("keydown", instructionHandler);
}

function instructionHandler(e) {
    document.removeEventListener("keydown", instructionHandler);
    setStimulusTextSize(STIMULUS_PX);
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
    <em>Drücken Sie eine beliebige Taste, um das Experiment zu starten.</em>`;
    document.addEventListener("keydown", secondExpStartHandler);
}

function secondExpStartHandler(e) {
    document.removeEventListener("keydown", secondExpStartHandler);
    stimulusDiv.style.display = "none";
    startSecondExperiment();
}
