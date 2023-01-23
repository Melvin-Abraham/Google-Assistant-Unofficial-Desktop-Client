import AssistantResponse from 'common/assistantResponse/assistantResponse';

class AssistantResponseStage {
  private stage: Partial<AssistantResponse>;
  onStageReady: () => void;

  constructor() {
    this.stage = {};
    this.onStageReady = (() => {});
  }

  set<K extends keyof AssistantResponse>(key: K, value: AssistantResponse[K]) {
    this.stage[key] = value;

    // If the stage is ready, invoke callback
    if (this.ready()) {
      this.onStageReady();
    }
  }

  get() {
    return this.stage;
  }

  ready() {
    return (
      this.stage.query !== undefined
      && this.stage.screenData !== undefined
      && this.stage.audioData !== undefined
    );
  }

  clear() {
    this.stage = {};
  }
}

export default AssistantResponseStage;
