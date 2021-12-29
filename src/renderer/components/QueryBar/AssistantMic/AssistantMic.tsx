import React, { useState, useEffect } from 'react';
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
    microphone.on('mic:started', () => {
      setMicActive(true);
    });

    microphone.on('mic:stopped', () => {
      setMicActive(false);
    });

    return () => {
      microphone.off('mic:started');
      microphone.off('mic:stopped');
    };
  }, []);

  return (
    <button
      id="assistant-mic"
      title={!isMicActive ? 'Speak' : 'Listening...'}
      type="button"
      onClick={() => {
        if (isMicActive) {
          audioPlayer.playPingStop();
          microphone.stop();
        }
        else {
          audioPlayer.playPingStart();
          microphone.start();
        }
      }}
    >
      <AssistantMicMain
        isMicActive={isMicActive}
        showListeningBar={() => {
          // Hide mic dots
          setMicDotsVisibility(true);
        }}
        hideListeningBar={() => {
          // Show mic dots
          setMicDotsVisibility(false);
        }}
      />

      { (isMicDotsVisible) && <AssistantMicDots /> }
    </button>
  );
}

export default AssistantMic;
