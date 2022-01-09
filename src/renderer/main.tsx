import React from 'react';
import ReactDOM from 'react-dom';
import gassist from 'gassist';
import { audioPlayer } from 'lib/audio/audioPlayer';
import './index.scss';
import App from './App';

// Set default Sink ID for audio player
audioPlayer.setDeviceId('default');

// Append incoming assistant audio response buffer to audio player
gassist.assistant.onAssistantAudioResponse((buffer) => {
  audioPlayer.appendBuffer(buffer);
});

// Play the audio response when conversation is complete
gassist.assistant.onAssistantConversationComplete(() => {
  console.log('Conversation Ended');
  audioPlayer.play();
});

// Handle screen data returned by the assistant
gassist.assistant.onScreenData((data, format) => {
  if (format === 'HTML') {
    const htmlString = data.toString();
    const htmlDocument = (new DOMParser()).parseFromString(htmlString, 'text/html');

    console.log('Screen Data', htmlDocument);
  }
});

// Render root element
// Marks entry-point for the app

const rootRenderElement = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

ReactDOM.render(rootRenderElement, document.getElementById('root'));
