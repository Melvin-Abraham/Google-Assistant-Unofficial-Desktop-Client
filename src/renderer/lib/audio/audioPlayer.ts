import { EventEmitter } from 'renderer/lib/eventEmitter';
import pingStart from 'res/audio/pingStart.mp3';
import pingStop from 'res/audio/pingStop.mp3';
import pingSuccess from 'res/audio/pingSuccess.mp3';

type HTMLAudioElementExtended = HTMLAudioElement & {
  setSinkId(sinkId: string): void
};

export interface AudioPlayer {
  on(type: 'player:waiting', listener: () => void): this;
  on(type: 'player:ready', listener: () => void): this;
  on(type: 'player:pingStart', listener: () => void): this;
  on(type: 'player:pingStop', listener: () => void): this;
  on(type: 'player:pingSuccess', listener: () => void): this;
}

/**
 * Audio Player for Google Assistant
 */
export class AudioPlayer extends EventEmitter {
  audioOutDeviceId: string;

  mediaSource?: MediaSource;
  audioPlayer?: HTMLAudioElementExtended;
  audioBuffer?: SourceBuffer;
  audioQueue?: Uint8Array[];

  constructor(audioOutDeviceId = 'default') {
    super();

    this.audioOutDeviceId = audioOutDeviceId;
    this.initialize();
  }

  initialize() {
    /** Variables for the Audio Player */
    this.mediaSource = new MediaSource();
    this.audioPlayer = new Audio() as HTMLAudioElementExtended;
    this.audioBuffer = undefined;
    this.audioQueue = [];

    this.setup();
    this.setupAudioProcessor();
  }

  /**
   * Reconstructs the current player.
   */
  reset() {
    this.initialize();
  }

  /**
   * Setups the player with the given buffer as source.
   */
  setup() {
    if (this.audioPlayer === undefined) return;

    this.audioPlayer.addEventListener('waiting', () => {
      console.log('[Audio Player] Player is waiting on data...');
      this.emit('player:waiting');
    });

    this.audioPlayer.preload = 'none';
    this.audioPlayer.autoplay = true;
    this.audioPlayer.src = URL.createObjectURL(this.mediaSource);
  }

  /**
   * Appends or queue's audio data into the buffer.
   */
  appendBuffer(buffer: Uint8Array) {
    const audioQueueLength = this.audioQueue?.length ?? 0;

    if (this.audioBuffer?.updating || audioQueueLength > 0) {
      this.audioQueue?.push(buffer);
    }
    else {
      this.audioBuffer?.appendBuffer(buffer);
    }
  }

  /**
   * Set's up the audio processor required to process the mpeg receiving by Google.
   */
  setupAudioProcessor() {
    this.mediaSource?.addEventListener('sourceopen', () => {
      if (this.mediaSource === undefined) return;

      this.audioBuffer = this.mediaSource.addSourceBuffer('audio/mpeg');
      this.audioBuffer.mode = 'sequence';
      this.audioBuffer.addEventListener('update', () => {
        if (
          this.audioQueue !== undefined
          && this.audioQueue.length > 0
          && this.audioBuffer
          && !this.audioBuffer.updating
        ) {
          const buffer = this.audioQueue.shift();
          if (buffer === undefined) return;

          this.audioBuffer.appendBuffer(buffer);
          this.play();
        }
      });

      this.audioBuffer.addEventListener('error', (e) => {
        console.log('[Audio Player] AudioBuffer Error: ', e);
      });

      this.emit('player:ready');
    });
  }

  /**
   * Play's the Audio Player if nessesary.
   */
  play() {
    this.audioPlayer?.setSinkId(this.audioOutDeviceId);

    if (this.audioPlayer?.paused) {
      this.audioPlayer
        .play()
        .then(() => {
          console.log('[Audio Player] Assistant Audio is playing...');
        })
        .catch((e) => {
          console.log('[Audio Player] Something went wrong while starting the player...', e);
        });
    }
  }

  /**
   * Empties the audioQueue and resets the current player.
   */
  stop() {
    if (this.audioPlayer === undefined) return;

    this.audioQueue = [];
    this.audioPlayer.src = '';
    this.reset();
  }

  /**
   * Sets the `sinkId` of the audio element to the given
   * speaker's device ID.
   *
   * @param {string} audioOutDeviceId
   * Device ID of desired speaker source
   */
  setDeviceId(audioOutDeviceId: string) {
    this.audioOutDeviceId = audioOutDeviceId;
    this.audioPlayer?.setSinkId(this.audioOutDeviceId);
  }

  playPingStart() {
    const pingPlayer = new Audio(pingStart) as HTMLAudioElementExtended;
    pingPlayer.setSinkId(this.audioOutDeviceId);
    pingPlayer.play();
    this.emit('player:pingStart');
  }

  playPingStop() {
    const pingPlayer = new Audio(pingStop) as HTMLAudioElementExtended;
    pingPlayer.setSinkId(this.audioOutDeviceId);
    pingPlayer.play();
    this.emit('player:pingStop');
  }

  playPingSuccess() {
    const pingPlayer = new Audio(pingSuccess) as HTMLAudioElementExtended;
    pingPlayer.setSinkId(this.audioOutDeviceId);
    pingPlayer.play();
    this.emit('player:pingSuccess');
  }
}

export const audioPlayer = new AudioPlayer();
