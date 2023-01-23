interface AssistantServiceEventHandlers {
  onQuery: (query: string) => void;
  onScreenData: (screenData: string) => void;
  onAudioData: (audioData: Buffer) => void;
}

export default AssistantServiceEventHandlers;
