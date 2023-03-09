import React, { useEffect, useState } from 'react';
import gassist from 'gassist';
import AssistantContainer from 'components/AssistantContainer/AssistantContainer';
import TitleBar from 'components/TitleBar/TitleBar';
import ResponseViewlet from 'components/ResponseViewlet/ResponseViewlet';
import SuggestionsViewlet, { Suggestions } from 'components/SuggestionsViewlet/SuggestionsViewlet';
import QueryBar from 'components/QueryBar/QueryBar';
import type AssistantResponse from 'renderer/types/assistantResponse';
import { AssistantHistoryProvider } from './contexts/assistantHistory/AssistantHistoryContext';
import './App.scss';

function App() {
  const suggestions: Suggestions[] = [
    { label: 'Weather' },
    { label: 'Toss a coin' },
    { label: 'What can you do?' },
  ];

  const [assistantResponseHistory, setAssistantResponseHistory] = useState<AssistantResponse[]>([]);
  const [historyHead, setHistoryHead] = useState(-1);

  useEffect(() => {
    gassist.assistant.onAssistantResponseHistory((history) => {
      setAssistantResponseHistory(history);
      setHistoryHead(history.length - 1);
    });
  }, []);

  return (
    <AssistantHistoryProvider
      value={{
        assistantResponseHistory,
        setAssistantResponseHistory,
        historyHead,
        setHistoryHead,
      }}
    >
      <div className="App">
        <AssistantContainer>
          <TitleBar query={assistantResponseHistory.at(historyHead)?.query} />
          <ResponseViewlet />
          <SuggestionsViewlet suggestions={suggestions} />
          <QueryBar />
        </AssistantContainer>
      </div>
    </AssistantHistoryProvider>
  );
}

export default App;
