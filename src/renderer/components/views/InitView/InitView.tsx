import React, { useEffect, useState } from 'react';
import { microphone } from 'lib/audio/microphone';
import AssistantLogoClear from 'res/images/assistant_logo_clear.svg?component';
import './InitView.scss';

function InitView() {
  const [isMicActive, setIsMicActive] = useState(false);

  useEffect(() => {
    const onMicStarted = () => setIsMicActive(true);
    const onMicStopped = () => setIsMicActive(false);

    microphone.on('mic:started', onMicStarted);
    microphone.on('mic:stopped', onMicStopped);

    return () => {
      microphone.off('mic:started', onMicStarted);
      microphone.off('mic:stopped', onMicStopped);
    };
  }, []);

  return (
    <div className="initview-root">
      <AssistantLogoClear className="logo" />

      <h1 className="initview-message">
        { (!isMicActive) ? 'Hi! How can I help?' : 'Listening...' }
      </h1>
    </div>
  );
}

export default InitView;
