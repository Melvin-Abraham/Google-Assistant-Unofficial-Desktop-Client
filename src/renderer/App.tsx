import React from 'react';
import AssistantContainer from 'components/AssistantContainer/AssistantContainer';
import TitleBar from 'components/TitleBar/TitleBar';
import ResponseViewlet from 'components/ResponseViewlet/ResponseViewlet';
import SuggestionsViewlet, { Suggestions } from 'components/SuggestionsViewlet/SuggestionsViewlet';
import QueryBar from 'components/QueryBar/QueryBar';
import { AssistantHistoryProvider } from 'renderer/contexts/assistantHistory';
import useHistory from 'renderer/hooks/useHistory';
import './App.scss';

function App() {
  const { currentHistoryItem } = useHistory();

  const suggestions: Suggestions[] = [
    { label: 'Weather' },
    { label: 'Toss a coin' },
    { label: 'What can you do?' },
  ];

  return (
    <AssistantHistoryProvider>
      <div className="App">
        <AssistantContainer>
          <TitleBar query={currentHistoryItem?.query} />
          <ResponseViewlet />
          <SuggestionsViewlet suggestions={suggestions} />
          <QueryBar />
        </AssistantContainer>
      </div>
    </AssistantHistoryProvider>
  );
}

export default App;
