import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import gassist from 'gassist';
import type AssistantResponse from 'renderer/types/assistantResponse';
import AssistantHistoryContext from './AssistantHistoryContext';

interface AssistantHistoryProviderProps {
  children: React.ReactNode;
}

function AssistantHistoryProvider({ children }: AssistantHistoryProviderProps) {
  const assistantResponseHistoryRef = useRef<AssistantResponse[]>([]);
  const assistantResponseHistory = useCallback(() => assistantResponseHistoryRef.current, []);
  const setAssistantResponseHistory = useCallback((history: AssistantResponse[]) => {
    assistantResponseHistoryRef.current = history;
  }, []);

  const [historyHead, setHistoryHead] = useState(-1);

  useEffect(() => {
    gassist.assistant.onAssistantResponseHistory((history) => {
      setAssistantResponseHistory(history);
      setHistoryHead(assistantResponseHistory().length);
    });

    gassist.assistant.onNewAssistantResponseItem((assistantResponse) => {
      // Push the new response to assistant response history list
      assistantResponseHistoryRef.current.push(assistantResponse);

      // Additionally trigger re-render for changes made in
      // assistant response history ref
      setHistoryHead(assistantResponseHistory().length - 1);
    });
  }, []);

  const historyContextValue = useMemo(() => ({
    assistantResponseHistory: assistantResponseHistory(),
    setAssistantResponseHistory,
    historyHead,
    setHistoryHead,
  }), [historyHead]);

  return (
    <AssistantHistoryContext.Provider value={historyContextValue}>
      { children }
    </AssistantHistoryContext.Provider>
  );
}

export default AssistantHistoryProvider;
