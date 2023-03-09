export type AssistantApiResponseType =
  | 'WebAnswer'
  | 'KnowledgePanel'
  | 'Carousel'
  | 'PhotoCarousel'
  | 'PlainText'
  | 'Definition'
  | 'Weather';

export interface AssistantApiResponse {
  responseType?: AssistantApiResponseType;
  identifiedElement?: HTMLElement;
}
