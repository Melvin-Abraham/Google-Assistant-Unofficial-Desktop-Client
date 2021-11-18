import React from 'react';
import AssistantContainer from 'renderer/components/AssistantContainer/AssistantContainer';
import TitleBar from 'renderer/components/TitleBar/TitleBar';
import AssistantLogo from 'res/images/assistant_logo.svg?component';
import './App.scss';

function App() {
  return (
    <div className="App">
      <AssistantContainer>
        <TitleBar />
      </AssistantContainer>
    </div>
  );
}

export default App;
