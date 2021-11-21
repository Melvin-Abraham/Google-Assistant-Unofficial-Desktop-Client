import React from 'react';
import AssistantContainer from 'components/AssistantContainer/AssistantContainer';
import TitleBar from 'components/TitleBar/TitleBar';
import ResponseViewlet from 'components/ResponseViewlet/ResponseViewlet';
import SuggestionsViewlet, { Suggestions } from 'components/SuggestionsViewlet/SuggestionsViewlet';
import QueryBar from 'renderer/components/QueryBar/QueryBar';
import './App.scss';

function App() {
  const suggestions: Suggestions[] = [
    { label: 'Weather' },
    { label: 'Toss a coin' },
    { label: 'What can you do?' },
  ];

  return (
    <div className="App">
      <AssistantContainer>
        <TitleBar />
        <ResponseViewlet />
        <SuggestionsViewlet suggestions={suggestions} />
        <QueryBar />
      </AssistantContainer>
    </div>
  );
}

export default App;
