interface AssistantResponse<T> {
  query: string;
  screenData: string | null;
  audioData: T | null;
  addtionalSuggestions?: [];
}

export default AssistantResponse;
