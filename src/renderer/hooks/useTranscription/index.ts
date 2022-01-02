import { useEffect, useState } from 'react';
import gassist from 'gassist';

interface TranscriptionObject {
  transcription: string;
  done: boolean;
}

function useTranscription() {
  const [audioTranscription, setAudioTranscription] = useState<TranscriptionObject | undefined>();

  useEffect(() => {
    gassist.assistant.onAudioTranscription((transcription, done) => {
      setAudioTranscription({ transcription, done });
    });

    gassist.assistant.onAssistantConversationComplete(() => {
      setAudioTranscription(undefined);
    });
  }, []);

  return audioTranscription;
}

export default useTranscription;
