interface AssistantResponse {
  query: string;
  screenData: string | null;
  audioData: Buffer | null;
  addtionalSuggestions?: [];
}

export default AssistantResponse;
