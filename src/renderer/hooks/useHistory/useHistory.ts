import { useContext, useMemo } from 'react';
import { AssistantHistoryContext } from 'renderer/contexts/assistantHistory';
import AssistantResponseTransformer from 'renderer/lib/assistantResponseTransformer/assistantResponseTransformer';

function useHistory() {
  const assistantHistoryContextData = useContext(AssistantHistoryContext);
  const { assistantResponseHistory, historyHead } = assistantHistoryContextData;

  const currentHistoryItem = useMemo(() => {
    const currentAssistantResponse = assistantResponseHistory.at(historyHead);
    if (currentAssistantResponse === undefined) return undefined;

    const assistantResponseTransformer = new AssistantResponseTransformer();
    const transformedScreenData = assistantResponseTransformer
      .transformScreenData(currentAssistantResponse.screenData);

    return { ...currentAssistantResponse, transformedScreenData };
  }, [assistantHistoryContextData.historyHead]);

  return { ...assistantHistoryContextData, currentHistoryItem };
}

export default useHistory;
