import type AssistantResponse from 'common/assistant-response/assistantResponseNode';

class AssistantResponseHistory {
  history: AssistantResponse[];
  historySeek: number | null;

  constructor() {
    this.history = [];
    this.historySeek = null;
  }

  append(response: AssistantResponse) {
    if (this.historySeek === null) {
      this.history.push(response);
      return;
    }

    this.history[this.historySeek] = response;
  }
}

export default AssistantResponseHistory;
