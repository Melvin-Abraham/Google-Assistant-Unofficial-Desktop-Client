import type AssistantResponse from 'common/assistant-response/assistantResponseNode';
import { MainIpcBroker } from 'main/ipc/main/mainIpcBroker';
import { AssistantService } from '../assistantService';
import AssistantResponseStage from './assistantResponseStage';

type ResponseInterceptor = (response: AssistantResponse) => (
  Promise<Partial<AssistantResponse> | null>
);

/**
 * Service which acts as a core part for managing assistant responses
 * and interceptors for transforming those responses
 */
class MiddlewareService {
  /**
   * Staging area for assistant response to be crafted
   */
  assistantResponseStage: AssistantResponseStage;

  /**
   * Instance of assistant service to interface with
   * Google Assistant API
   */
  assistantService: AssistantService;

  /**
   * List of interceptors executed upon API fetched response
   * to transform final response
   */
  responseInterceptors: ResponseInterceptor[];

  constructor() {
    this.assistantResponseStage = new AssistantResponseStage();
    this.assistantService = new AssistantService();
    this.responseInterceptors = [];

    this.assistantService.initialize({
      onQuery: (query) => this.assistantResponseStage.set('query', query),
      onScreenData: (screenData) => this.assistantResponseStage.set('screenData', screenData),
      onAudioData: (audioData) => {
        const stageAudioData = this.assistantResponseStage.get().audioData ?? new Uint8Array();
        const concatenatedAudioData = Buffer.concat([stageAudioData, audioData]);

        this.assistantResponseStage.set('audioData', concatenatedAudioData);
      },
      onConversationEnded: () => this.postStageReadyCallback(),
    });
  }

  /**
   * Callback invoked when assistant response stage is ready with
   * API fetched response
   */
  async postStageReadyCallback() {
    // If the response stage is not valid (in some cases), don't proceed
    if (!this.assistantResponseStage.valid()) return;

    const assistantResponse = this.assistantResponseStage.get();
    this.assistantResponseStage.clear();

    const modifiedResponse = await this.invokeInterceptors(<AssistantResponse>assistantResponse);
    global.assistantResponseHistory.append(modifiedResponse);

    MainIpcBroker.sendIpcMessageToRenderer(
      'assistant:newAssistantResponseItem',
      { assistantResponse: modifiedResponse },
    );
  }

  /**
   * Registers interceptor to execute upon API fetched assistant response
   * and transform it as needed. If an interceptor decides to not modify
   * the response, it may return `null` to let other interceptors process
   * the response.
   *
   * @param interceptor Interceptor to run on the assistant response
   */
  registerInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Executes all the registered interceptors with API fetched assistant
   * response and returns a transformed response based on quick reply.
   * If none of the interceptors respond within a maximum time of 5 secs,
   * the original response will be returned back.
   *
   * @param assistantResponse The response received via Assistant Service
   * @returns Assistant response after transformation by interceptors
   */
  async invokeInterceptors(assistantResponse: AssistantResponse) {
    // If no interceptors are registered, directly
    // return the original response
    if (this.responseInterceptors.length === 0) {
      return assistantResponse;
    }

    // Default interceptor which will resolve after a timeout,
    // just in case no other interceptors respond
    const defaultTimedInterceptor = (response: AssistantResponse) => (
      new Promise<AssistantResponse>((resolve) => {
        const maxTimeout = 5000;
        setTimeout(() => resolve(response), maxTimeout);
      })
    );

    const runnables = [...this.responseInterceptors, defaultTimedInterceptor].map(
      (interceptor) => MiddlewareService._interceptorWrapper(interceptor, assistantResponse),
    );

    const modifiedAssistantResponse = await Promise.any(runnables);
    return { ...assistantResponse, ...modifiedAssistantResponse };
  }

  /**
   * Wraps the call to interceptor and rejects `null` responses.
   * An interceptor can return `null` to signify no transformation,
   * this allows other interceptors to modify response.
   */
  static _interceptorWrapper(
    interceptor: ResponseInterceptor,
    assistantResponse: AssistantResponse,
  ) {
    return new Promise<AssistantResponse>((resolve, reject) => {
      interceptor(assistantResponse).then((result) => {
        if (result === null) {
          reject(result);
          return;
        }

        resolve(<AssistantResponse>result);
      });
    });
  }
}

export default MiddlewareService;
