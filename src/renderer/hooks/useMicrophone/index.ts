import { useEffect, useState } from 'react';
import { microphone, MicrophoneData } from 'lib/audio/microphone';

function useMicrophone() {
  const [microphoneData, setMicrophoneData] = useState<MicrophoneData | undefined>();

  useEffect(() => {
    // Mic stop event handler
    const onMicStopped = () => {
      setMicrophoneData(undefined);
    };

    // Mic data handler
    const onMicData = (data: MicrophoneData) => {
      setMicrophoneData(data);
    };

    microphone.on('mic:data', onMicData);
    microphone.on('mic:stopped', onMicStopped);

    return () => {
      // Remove event listeners when unmounting
      microphone.off('mic:data', onMicData);
      microphone.off('mic:stopped', onMicStopped);
    };
  }, []);

  return microphoneData;
}

export default useMicrophone;
