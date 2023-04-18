import { createContext } from 'react';
import type AssistantResponse from 'renderer/types/assistantResponse';

const defaultAssistantHistory: AssistantResponse[] = [];

const context = createContext({
  assistantResponseHistory: defaultAssistantHistory,
  setAssistantResponseHistory: (_history: AssistantResponse[]) => {},
  historyHead: 0,
  setHistoryHead: (_head: number) => {},
});

export default context;
