import { EventEmitter } from 'lib/eventEmitter';

export interface Microphone {
  /**
   * Event emitted when microphone is ready for use
   */
  on(type: 'mic:ready', listener: () => void): this;

  /**
   * Event emitted when microphone starts
   */
  on(type: 'mic:started', listener: () => void): this;

  /**
   * Event emitted when microphone stops
   */
  on(type: 'mic:stopped', listener: () => void): this;

  /**
   * Returns a downsampled audio buffer to be relayed to
   * the assistant service
   */
  on(type: 'mic:data', listener: (data: {
    buffer: ArrayBufferLike,
    level: number,
  }) => void): this;
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
   * @param audioInDeviceId
   * Device ID of desired microphone source
   */
  setDeviceId(audioInDeviceId: string) {
    this.audioInDeviceId = audioInDeviceId;
  }

  /**
   * Processes the audio to be ready for Google.
   */
  onAudioProcess(event: AudioProcessingEvent) {
    const data = event.inputBuffer.getChannelData(0);
    const downsampledData = this.downsampleBuffer(data);
    const level = Microphone.getLevel(data);

    this.emit('mic:data', {
      buffer: downsampledData,
      level,
    });
  }

  /**
   * Downsamles the audio buffer if needed to right sampleRate and
   * converts the data into an int16 buffer
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

  /**
   * Returns the instantaneous level or loudness of input audio
   */
  static getLevel(buffer: Float32Array) {
    const bufLength = buffer.length;
    let sum = 0;

    // Do a root-mean-square on the samples: sum up the squares
    for (const sample of buffer) {
      sum += sample ** 2;
    }

    // Take the square root of the average of sum
    const rms = Math.sqrt(sum / bufLength);

    // Map the level from 0 to 1 based on threshold
    const levelThreshold = 0.1;
    const actualLower = 0;
    const actualUpper = levelThreshold;
    const mapLower = 0;
    const mapUpper = 1;

    const mappedLevel = ((rms - actualLower) / (actualUpper - actualLower))
      * (mapUpper - mapLower)
      + mapLower;

    // Constrain the level strictly between 0 and 1
    const constrainedLevel = Math.min(Math.max(mappedLevel, 0), 1);

    // Return the constrained level
    return constrainedLevel;
  }
}

export const microphone = new Microphone();
