import { EventEmitter } from 'renderer/lib/eventEmitter';

export interface Microphone {
  on(type: 'mic:ready', listener: () => void): this;
  on(type: 'mic:started', listener: () => void): this;
  on(type: 'mic:stopped', listener: () => void): this;
  on(type: 'mic:data', listener: (buffer: ArrayBufferLike) => void): this;
}

export class Microphone extends EventEmitter {
  rawStream?: MediaStream;
  stream?: MediaStreamAudioSourceNode;
  audioProcessor?: ScriptProcessorNode;

  audioContext: AudioContext;
  bufferSize: number;
  sampleRate: number;
  audioInDeviceId: string;

  constructor(audioInDeviceId = 'default', sampleRate = 16000) {
    super();

    this.audioContext = new AudioContext();
    this.bufferSize = 4096;

    this.sampleRate = sampleRate;
    this.audioInDeviceId = audioInDeviceId;
  }

  /**
   * Opens & initializes the Microphone stream from the browser.
   */
  start() {
    navigator.mediaDevices
      .getUserMedia({
        audio: { deviceId: { exact: this.audioInDeviceId } },
        video: false,
      })
      .then((rawStream) => {
        this.rawStream = rawStream;
        this.stream = this.audioContext.createMediaStreamSource(this.rawStream);

        this.audioProcessor = this.audioContext.createScriptProcessor(
          this.bufferSize, 1, 1,
        );

        this.audioProcessor.onaudioprocess = (event) => {
          this.onAudioProcess(event);
        };

        this.stream.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioContext.destination);
        this.emit('mic:ready');
      });

    this.emit('mic:started');
  }

  /**
   * Closes the Microphone stream for the browser.
   */
  stop() {
    if (!this.isActive) return;

    this.stream?.disconnect();
    this.rawStream?.getTracks().forEach((track) => track.stop());

    if (this.audioProcessor !== undefined) {
      this.audioProcessor.disconnect();
      this.audioProcessor.onaudioprocess = null;
      this.audioProcessor = undefined;
    }

    this.emit('mic:stopped');
  }

  /**
   * Getter function for checking if the microphone is active.
   */
  get isActive() {
    return this.audioProcessor !== undefined;
  }

  /**
   * Sets the `audioInDeviceId` to provided Device ID.
   *
   * @param {string} audioInDeviceId
   * Device ID of desired microphone source
   */
  setDeviceId(audioInDeviceId: string) {
    this.audioInDeviceId = audioInDeviceId;
  }

  /**
   * Processes the audio to be ready for Google.
   *
   * @param event event
   */
  onAudioProcess(event: AudioProcessingEvent) {
    const data = event.inputBuffer.getChannelData(0);
    const downsampledData = this.downsampleBuffer(data);

    // [TODO]: Implement piping?
    this.emit('mic:data', downsampledData);
  }

  /**
   * Downsamles the buffer if needed to right sampleRate & converts the data into an int16 buffer
   *
   * @param buffer buffer
   */
  downsampleBuffer(buffer: Float32Array) {
    if (this.audioContext.sampleRate === this.sampleRate) {
      return buffer;
    }
    const sampleRateRatio = this.audioContext.sampleRate / this.sampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i += 1
      ) {
        accum += buffer[i];
        count += 1;
      }
      result[offsetResult] = Math.min(1, accum / count) * 0x7fff;
      offsetResult += 1;
      offsetBuffer = nextOffsetBuffer;
    }
    return result.buffer;
  }
}

export const microphone = new Microphone();
