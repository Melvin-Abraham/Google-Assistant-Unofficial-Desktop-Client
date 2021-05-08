onmessage = function (e) {
    switch (e.data.command) {
        case "init":
            init(e.data.inputSampleRate);
            break;
        case "process":
            process(e.data.inputFrame);
            break;
        case "reset":
            reset();
            break;
    }
};

let inputSampleRate;
let inputBuffer = [];
let inputBufferFloat = [];

function init(x) {
    inputSampleRate = x;
}

function process(inputFrame) {
    for (let i = 0; i < inputFrame.length; i++) {
        inputBuffer.push(inputFrame[i] * 32767);
        inputBufferFloat.push(inputFrame[i]);
    }

    const PV_SAMPLE_RATE = 16000;
    const PV_FRAME_LENGTH = 512;

    while ((inputBuffer.length * PV_SAMPLE_RATE / inputSampleRate) > PV_FRAME_LENGTH) {
        let outputFrame = new Int16Array(PV_FRAME_LENGTH);
        let outputFrameFloat = new Float32Array(PV_FRAME_LENGTH);
        let sum = 0;
        let sumFloat = 0;
        let num = 0;
        let outputIndex = 0;
        let inputIndex = 0;

        while (outputIndex < PV_FRAME_LENGTH) {
            sum = 0;
            sumFloat = 0;
            num = 0;
            while (inputIndex < Math.min(inputBuffer.length, (outputIndex + 1) * inputSampleRate / PV_SAMPLE_RATE)) {
                sum += inputBuffer[inputIndex];
                sumFloat += inputBufferFloat[inputIndex];
                num++;
                inputIndex++;
            }
            outputFrame[outputIndex] = sum / num;
            outputFrameFloat[outputIndex] = sumFloat / num;
            outputIndex++;
        }
        
        postMessage({
            outputFrame,
            outputFrameFloat
        });

        inputBuffer = inputBuffer.slice(inputIndex);
        inputBufferFloat = inputBufferFloat.slice(inputIndex);
    }
}

function reset() {
    inputBuffer = [];
    inputBufferFloat = [];
}