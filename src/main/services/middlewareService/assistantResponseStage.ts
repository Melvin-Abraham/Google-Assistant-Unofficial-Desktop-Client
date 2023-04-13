import type AssistantResponse from 'common/assistant-response/assistantResponseNode';

/**
 * Consolidates the response fetched by Assistant API
 */
class AssistantResponseStage {
  private stage: Partial<AssistantResponse>;

  constructor() {
    this.stage = {};
  }

  set<K extends keyof AssistantResponse>(key: K, value: AssistantResponse[K]) {
    this.stage[key] = value;
  }

  get() {
    return this.stage;
  }

  valid() {
    // Check if the stage has atleast some data to
    // be classified as valid
    const hasData = [
      this.stage.screenData,
      this.stage.audioData,
    ].some((value) => value !== undefined);

    return (
      this.stage.query !== undefined
      && this.stage.query.length > 0
      && hasData
    );
  }

  clear() {
    this.stage = {};
  }
}

export default AssistantResponseStage;
