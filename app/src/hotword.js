const Bumblebee = require('bumblebee-hotword');

/**
 * Returns an instance of hotword detector
 *
 * @param {(hotword: string) => void} onHotword
 * Function called when hotword is detected.
 */
function getHotwordDetectorInstance(onHotword) {
  // Create instance of Bumblebee

  /**
   * @type {Bumblebee & { setMicrophone?: (id: string) => void }}
   */
  const bumblebee = new Bumblebee();

  // set path to worker files
  bumblebee.setWorkersPath('./lib/pv_workers');

  // add hotword
  bumblebee.addHotword('hey_google');
  bumblebee.addHotword('ok_google');

  // set sensitivity (from 0.0 to 1.0)
  bumblebee.setSensitivity(1);

  // Call `onHotword` when hotword is detected
  bumblebee.on('hotword', (hotword) => onHotword(hotword));

  // Return Hotword Detection Instance
  return bumblebee;
}

module.exports = { getHotwordDetectorInstance };
