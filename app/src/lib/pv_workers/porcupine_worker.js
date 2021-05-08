importScripts("pv_porcupine.js");
importScripts("porcupine.js");

onmessage = function (e) {
    switch (e.data.command) {
        case "init":
            init(e.data.keywordIDs, e.data.sensitivities);
            break;
        case "process":
            process(e.data.inputFrame, e.data.inputFrameFloat);
            break;
        case "release":
            release();
            break;
    }
};

let keywordIDArray;
let keywords;
let sensitivities;

let porcupine = null;

function init(keywordIDs, _sensitivities_) {
    keywordIDArray = Object.values(keywordIDs);
    keywords = Object.keys(keywordIDs);
    sensitivities = _sensitivities_;

    if (Porcupine.isLoaded()) {
        porcupine = Porcupine.create(keywordIDArray, sensitivities);
    }
}

function process(inputFrame, inputFrameFloat) {
    // debugger;
    if (porcupine == null && Porcupine.isLoaded()) {
        porcupine = Porcupine.create(keywordIDArray, sensitivities);
    } else if (porcupine != null) {
        let keywordIndex = porcupine.process(inputFrame, inputFrameFloat);
        postMessage({
            keyword: keywordIndex === -1 ? null : keywords[keywordIndex],
            inputFrame,
            inputFrameFloat
        });
    }
}

function release() {
    if (porcupine !== null) {
        porcupine.release();
    }

    porcupine = null;
}
