interface AssistantServiceEventHandlers {
  onQuery: (query: string) => void;
  onScreenData: (screenData: string) => void;
  onAudioData: (audioData: Buffer) => void;
  onConversationEnded: () => void;
}

export default AssistantServiceEventHandlers;
