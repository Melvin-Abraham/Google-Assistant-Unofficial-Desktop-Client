import React from 'react';
import ReactDOM from 'react-dom';
import gassist from 'gassist';
import { audioPlayer } from 'lib/audio/audioPlayer';
import { AssistantHistoryProvider } from 'renderer/contexts/assistantHistory';
import { AssistantConfigProvider } from 'renderer/contexts/config';
import App from './App';
import './index.scss';

// Set default Sink ID for audio player
audioPlayer.setDeviceId('default');

// Append incoming assistant audio response buffer to audio player
gassist.assistant.onNewAssistantResponseItem((assistantResponse) => {
  const { audioData } = assistantResponse;

  // Play audio output if available
  if (audioData !== null) {
    audioPlayer.appendBuffer(audioData);
    audioPlayer.play();
  }
});

// Stop the audio response playback when requested by main process
// Possibly called when the user triggers a text query
gassist.assistant.onRequestStopAudioResponsePlayback(() => {
  audioPlayer.stop();
});

// Play the audio response when conversation is complete
gassist.assistant.onAssistantConversationComplete(() => {
  console.log('Conversation Ended');
  audioPlayer.play();
});

// Handle screen data returned by the assistant
gassist.assistant.onScreenData((data, format) => {
  if (format === 'HTML') {
    const htmlString = data;
    const htmlDocument = (new DOMParser()).parseFromString(htmlString, 'text/html');

    console.log('Screen Data', htmlDocument);
  }
});

// Render root element
// Marks entry-point for the app

const rootRenderElement = (
  <React.StrictMode>
    <AssistantConfigProvider>
      <AssistantHistoryProvider>
        <App />
      </AssistantHistoryProvider>
    </AssistantConfigProvider>
  </React.StrictMode>
);

ReactDOM.render(rootRenderElement, document.getElementById('root'));
