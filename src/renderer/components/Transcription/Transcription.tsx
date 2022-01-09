import React, { useEffect } from 'react';
import useTranscription from 'hooks/useTranscription';
import { audioPlayer } from 'lib/audio/audioPlayer';
import './Transcription.scss';

interface TranscriptionProps {
  onTranscriptionAvailable(): void;
  onTranscriptionUnavailable(): void;
}

export default function Transcription({
  onTranscriptionAvailable,
  onTranscriptionUnavailable,
}: TranscriptionProps) {
  const voiceTranscription = useTranscription();

  useEffect(() => {
    if (voiceTranscription) {
      onTranscriptionAvailable();
    }
    else {
      onTranscriptionUnavailable();
    }

    // If audio transcription completed successfully,
    // Let the user know by playing the success ping sound
    if (voiceTranscription?.done) {
      audioPlayer.playPingSuccess();
    }
  }, [voiceTranscription]);

  if (voiceTranscription === undefined) {
    return null;
  }

  return (
    <div
      className="transcription-container"
      data-transcription-done={voiceTranscription.done}
    >
      { voiceTranscription.transcription }
    </div>
  );
}
