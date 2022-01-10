import React, { useState, useEffect } from 'react';
import gassist from 'gassist';
import { microphone } from 'lib/audio/microphone';
import { audioPlayer } from 'lib/audio/audioPlayer';
import AssistantMicMain from './AssistantMicMain';
import AssistantMicDots from './AssistantMicDots';
import './AssistantMic.scss';

/**
 * Renders assistant mic button
 */
function AssistantMic() {
  const [isMicActive, setMicActive] = useState(microphone.isActive);
  const [isMicDotsVisible, setMicDotsVisibility] = useState(false);

  useEffect(() => {
    const onMicStarted = () => setMicActive(true);
    const onMicStopped = () => setMicActive(false);

    microphone.on('mic:started', onMicStarted);
    microphone.on('mic:stopped', onMicStopped);

    // Stop sending mic data to assistant once the user is done speaking
    gassist.assistant.onEndOfUtterance(() => {
      microphone.stop();
    });

    // Handle mic stop request
    gassist.assistant.onRequestStopMic(() => {
      interruptAssistantVoiceQuery();
    });

    // Handle mic start request usually for immediate response
    gassist.assistant.onRequestStartMic(() => {
      const onPlayerWaiting = () => {
        audioPlayer.off('player:waiting', onPlayerWaiting);
        invokeAssistantVoiceQuery();
      };

      // If the audio player is done playing previous audio response,
      // activate the mic
      audioPlayer.on('player:waiting', onPlayerWaiting);
    });

    return () => {
      microphone.off('mic:started', onMicStarted);
      microphone.off('mic:stopped', onMicStopped);
    };
  }, []);

  return (
    <button
      id="assistant-mic"
      title={!isMicActive ? 'Speak' : 'Listening...'}
      type="button"
      onClick={() => {
        if (isMicActive) {
          interruptAssistantVoiceQuery();
        }
        else {
          invokeAssistantVoiceQuery();
        }
      }}
    >
      <AssistantMicMain
        isMicActive={isMicActive}
        showListeningBar={() => setMicDotsVisibility(true)}
        hideListeningBar={() => setMicDotsVisibility(false)}
      />

      { (isMicDotsVisible) && <AssistantMicDots /> }
    </button>
  );
}

/**
 * Invoke voice query & start the mic
 */
function invokeAssistantVoiceQuery() {
  // Stop voice player if already playing audio response back
  audioPlayer.stop();
  audioPlayer.playPingStart();

  // Invoke assistant for voice query and start microphone
  gassist.assistant.invokeAssistant();
  microphone.start();
}

/**
 * Interrupt ongoing voice query & stop the mic
 */
function interruptAssistantVoiceQuery() {
  microphone.stop();
  audioPlayer.playPingStop();
}

export default AssistantMic;
