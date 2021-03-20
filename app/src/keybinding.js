const { EventEmitter } = require('events');
const process = require('process');

/**
 * Listener for key combinations
 *
 * @fires KeyBindingListener#key-combination
 * @fires KeyBindingListener#cancel
 */
class KeyBindingListener extends EventEmitter {
  constructor() {
    super();
    this.blacklistedKeys = [
      'Meta',
      'Shift',
      'Alt',
      'Control',
      'CapsLock',
      'ContextMenu',
    ];
    this.listener = null;
  }

  /**
   * Event listener for `keydown` event
   *
   * @param {KeyboardEvent} e
   * @param {bool} stopListeningAfterKeyCombination
   * @param {bool} escapeToCancel
   */
  keyDownListener(e, stopListeningAfterKeyCombination, escapeToCancel) {
    e.preventDefault();

    if (e.key === 'Escape' && escapeToCancel) {
      this.stopListening();
      this.emit('cancel');
      return;
    }

    if (!this.blacklistedKeys.includes(e.key)) {
      const keyList = [];

      if (e.metaKey) keyList.push('Super');
      if (e.ctrlKey) keyList.push('Ctrl');
      if (e.altKey) keyList.push('Alt');
      if (e.shiftKey) keyList.push('Shift');

      keyList.push(getNormalizedKeyName(e.key));

      if (keyList.length >= 2) {
        this.emit('key-combination', keyList);
        if (stopListeningAfterKeyCombination) this.stopListening();
      }
    }
  }

  /**
   * Start listening for key combinations.
   *
   * Any key combinations _(excluding global shortcuts)_
   * will be ignored in the application-level.
   *
   * @param {bool} stopListeningAfterKeyCombination
   * Removes `keydown` event listener after a key combination
   * has been pressed by the user.
   *
   * @param {bool} escapeToCancel
   * Stops listening for key combinations when `ESC` key is
   * pressed.
   */
  startListening(
    stopListeningAfterKeyCombination = false,
    escapeToCancel = true,
  ) {
    this.listener = (e) => {
      this.keyDownListener(
        e,
        stopListeningAfterKeyCombination,
        escapeToCancel,
      );
    };

    window.addEventListener('keydown', this.listener);
  }

  /**
   * Stop listening for `keydown` events
   */
  stopListening() {
    if (this.listener) {
      window.removeEventListener('keydown', this.listener);
    }
  }
}

/**
 * Returns normalized key name compliant with
 * Electron Accelerator API.
 *
 * @param {string} keyboardKey
 * Name of the key
 */
function getNormalizedKeyName(keyboardKey) {
  const key = keyboardKey.trim();

  const keyMap = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };

  if (key.length === 1) {
    return key.toUpperCase();
  }

  if (Object.keys(keyMap).includes(key)) {
    return keyMap[key];
  }

  return key;
}

/**
 * Returns the platform-specific key name
 * for given key.
 *
 * @param {string} keyboardKey
 * Name of the key
 */
function getNativeKeyName(keyboardKey) {
  const key = keyboardKey.trim();

  const keyMap = {
    Ctrl: {
      mac: 'Control',
      win: 'Ctrl',
      linux: 'Ctrl',
    },
    Super: {
      mac: 'Command',
      win: 'Windows',
      linux: 'Super',
    },
    Alt: {
      mac: 'Option',
      win: 'Alt',
      linux: 'Alt',
    },
  };

  let platform = '';

  switch (process.platform) {
    case 'win32':
      platform = 'win';
      break;

    case 'darwin':
      platform = 'mac';
      break;

    default:
      platform = 'linux';
  }

  if (Object.keys(keyMap).includes(key)) {
    return keyMap[key][platform];
  }

  return key;
}

module.exports = {
  KeyBindingListener,
  getNativeKeyName,
  getNormalizedKeyName,
};
