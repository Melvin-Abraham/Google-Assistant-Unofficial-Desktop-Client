/* eslint-disable no-param-reassign */

import gassist from 'gassist';
import type AssistantResponse from 'renderer/types/assistantResponse';
import { AssistantApiResponse } from './assistantApiResponseType';

class AssistantResponseTransformer {
  screenData?: HTMLElement;

  /**
   * Perform transformations on screen data
   *
   * @param screenData
   * Assistant response received from main process
   * (Assistant API or custom user response)
   *
   * @param autoScale
   * Should the Assistant API response be auto-scaled
   */
  transformScreenData(screenData: AssistantResponse['screenData'], autoScale = true) {
    this.setScreenData(screenData);
    if (this.screenData === undefined) return null;

    // If the screen data does not conform to assistant API response,
    // return the screen data as is from here
    if (!this.isAssistantApiResponse()) {
      return this.screenData;
    }

    // If the screen data conforms to Assistant API response,
    // continue with further transformations and return content root
    this.processScreenData();
    if (autoScale) this.autoScaleScreenData();

    return this.getAssistantApiResponseContentRoot();
  }

  /**
   * Parse the screen data and store internally for
   * further operations.
   */
  private setScreenData(screenData: AssistantResponse['screenData']) {
    if (screenData === null) return;

    const domParser = new DOMParser();
    const screenDataParsedDocument = domParser.parseFromString(screenData, 'text/html');

    this.screenData = screenDataParsedDocument.documentElement;
  }

  /**
   * Returns the root of main content in Assistant API response
   */
  private getAssistantApiResponseContentRoot() {
    if (this.screenData === undefined) return null;

    const assistantApiResponseContentRootSelector = '#assistant-card-content';
    return this.screenData.querySelector(assistantApiResponseContentRootSelector);
  }

  /**
   * Checks if the set screen data conforms to Assistant API response
   */
  private isAssistantApiResponse() {
    return !!this.getAssistantApiResponseContentRoot();
  }

  /**
   * Determines the response type for Assistant API response.
   *
   * @warn
   * Invocation of this method assumes that the screen data
   * is an Assistant API response. Manually check if the screen data
   * conforms to Assistant API response before invoking this method.
   */
  private inspectResponseType(): AssistantApiResponse | null {
    if (this.screenData === undefined) return null;

    const assistantApiResponseContentRoot = this.getAssistantApiResponseContentRoot()!;
    const assistantApiResponseMainContent = assistantApiResponseContentRoot.lastElementChild!;

    const hasWebAnswer = this.screenData.querySelector('#tv_web_answer_root');
    if (hasWebAnswer) {
      return {
        responseType: 'WebAnswer',
        identifiedElement: hasWebAnswer as HTMLElement,
      };
    }

    const hasKnowledgePanel = this.screenData.querySelector('#tv_knowledge_panel_source');
    if (hasKnowledgePanel) {
      return {
        responseType: 'KnowledgePanel',
        identifiedElement: hasKnowledgePanel as HTMLElement,
      };
    }

    const hasPhotoCarousel = this.screenData.querySelector('#photo-carousel-tv');
    if (hasPhotoCarousel) {
      return {
        responseType: 'PhotoCarousel',
        identifiedElement: hasPhotoCarousel as HTMLElement,
      };
    }

    const hasCarousel = this.screenData.querySelector('#selection-carousel-tv');
    if (hasCarousel) {
      return {
        responseType: 'Carousel',
        identifiedElement: hasCarousel as HTMLElement,
      };
    }

    const hasTextContainer = assistantApiResponseMainContent.classList.contains('show_text_container');
    const hasPlainText = hasTextContainer && assistantApiResponseMainContent.querySelector('.show_text_content');

    if (hasPlainText) {
      return {
        responseType: 'PlainText',
        identifiedElement: hasPlainText as HTMLElement,
      };
    }

    const phoneticsRegex = /\/.+?\//;
    const hasDefinition = (
      this.screenData.querySelector('#flex_text_audio_icon_chunk')
      || assistantApiResponseMainContent.querySelector('div:nth-child(1)')?.textContent?.match(phoneticsRegex)
    );

    if (hasDefinition) {
      return {
        responseType: 'Definition',
        identifiedElement: (hasDefinition instanceof Element)
          ? hasDefinition as HTMLElement
          : undefined,
      };
    }

    const hasWeather = this.screenData.querySelector('img[src*="https://www.gstatic.com/images/icons/material/apps/weather"]');
    if (hasWeather) {
      return {
        responseType: 'Weather',
        identifiedElement: hasWeather as HTMLElement,
      };
    }

    return {
      responseType: undefined,
      identifiedElement: undefined,
    };
  }

  /**
   * Performs basic processing on Assistant API screen data.
   * Skips processing on custom user response.
   *
   * @warn
   * Invocation of this method assumes that the screen data
   * is an Assistant API response. Manually check if the screen data
   * conforms to Assistant API response before invoking this method.
   */
  private processScreenData() {
    const responseType = this.inspectResponseType();
    if (responseType === null) return;

    const assistantApiResponseContentRoot = (
      this.getAssistantApiResponseContentRoot()! as HTMLElement
    );
    const assistantApiResponseMainContent = (
      assistantApiResponseContentRoot.lastElementChild! as HTMLElement
    );

    // Extract out the main carousel element and set it as the main content
    if (responseType.responseType === 'Carousel' && responseType.identifiedElement !== undefined) {
      assistantApiResponseMainContent.innerHTML = responseType.identifiedElement.outerHTML;
    }

    // Place the info & image side-by-side in knowledge panel
    if (responseType.responseType === 'KnowledgePanel' && responseType.identifiedElement !== undefined) {
      responseType.identifiedElement.style.display = 'flex';
    }

    // Play the pronunciation audio in definition response when user clicks on the speaker icon
    if (responseType.responseType === 'Definition' && responseType.identifiedElement !== undefined) {
      responseType.identifiedElement.style.cursor = 'pointer';
      responseType.identifiedElement.onclick = () => {
        assistantApiResponseMainContent.querySelector('audio')?.play();
      };
    }

    // Set the image source on image elements to display to the user
    if (responseType.responseType === 'PhotoCarousel') {
      const images = assistantApiResponseMainContent.querySelectorAll('img[data-src]');

      images.forEach((imageElement) => {
        const imageSource = imageElement.getAttribute('data-src');
        imageElement.setAttribute('src', imageSource ?? '');
      });
    }

    // Register horizontal scroll for carousel type responses
    if (['Carousel', 'PhotoCarousel'].includes(responseType.responseType!)) {
      const tvItemContainer = assistantApiResponseMainContent.querySelector('#tv-item-container');
      const scrollContainer = (tvItemContainer ?? assistantApiResponseMainContent) as HTMLElement;

      scrollContainer.style.overflowX = 'scroll';
      AssistantResponseTransformer.registerHorizontalScroll(scrollContainer as HTMLElement);
    }

    // Invoke follow up query on click for elements which have the same defined
    const followUpQueryElements = assistantApiResponseMainContent.querySelectorAll('[data-follow-up-query]') as NodeListOf<HTMLElement>;

    followUpQueryElements.forEach((element) => {
      const followUpQuery = element.getAttribute('data-follow-up-query');

      element.style.cursor = 'pointer';
      element.setAttribute('tabindex', '0');
      element.onclick = () => {
        if (followUpQuery === null) return;
        gassist.assistant.invokeAssistant(followUpQuery);
      };
    });

    // @todo: Add link support with `data-src`
    // @todo: Custom redirection for anchor tag with `href` (user created response)
  }

  /**
   * Applies auto-scaling to Assistant API screen data.
   * If the screen data is a custom user response,
   * auto-scaling is skipped.
   *
   * @warn
   * Invocation of this method assumes that the screen data
   * is an Assistant API response. Manually check if the screen data
   * conforms to Assistant API response before invoking this method.
   */
  private autoScaleScreenData() {
    const responseType = this.inspectResponseType();
    if (responseType === null) return;

    const assistantApiResponseContentRoot = (
      this.getAssistantApiResponseContentRoot()! as HTMLElement
    );
    const assistantApiResponseMainContent = (
      assistantApiResponseContentRoot.lastElementChild! as HTMLElement
    );

    // Common styles
    assistantApiResponseMainContent.style.position = 'relative';

    // Style modification based on Assistant API response type
    switch (responseType.responseType) {
      case 'PlainText':
        assistantApiResponseMainContent.style.transform = 'scale(1.2)';
        assistantApiResponseMainContent.style.left = '13%';
        assistantApiResponseMainContent.style.top = '60px';

        assistantApiResponseContentRoot.classList.add('no-x-scroll');
        break;

      case 'KnowledgePanel':
        assistantApiResponseMainContent.style.transform = 'scale(0.65)';
        assistantApiResponseMainContent.style.transformOrigin = 'left';
        assistantApiResponseMainContent.style.left = '32px';
        assistantApiResponseMainContent.style.top = '-40px';
        assistantApiResponseMainContent.style.width = '140%';
        break;

      case 'WebAnswer':
        assistantApiResponseMainContent.style.transform = 'scale(0.65)';
        assistantApiResponseMainContent.style.left = '-15%';
        assistantApiResponseMainContent.style.top = '-35px';
        break;

      case 'PhotoCarousel':
      case 'Carousel':
        assistantApiResponseContentRoot.style.transform = 'scale(0.65)';
        assistantApiResponseContentRoot.style.transformOrigin = 'top left';
        assistantApiResponseMainContent.style.left = '-80px';
        assistantApiResponseMainContent.style.top = '-55px';
        assistantApiResponseMainContent.style.width = 'calc(100vw * 1.57)';
        assistantApiResponseMainContent.style.overflowX = 'scroll';
        break;

      case 'Definition':
        assistantApiResponseContentRoot.style.transform = 'scale(0.7)';
        assistantApiResponseContentRoot.style.transformOrigin = 'top left';
        assistantApiResponseMainContent.style.left = '45px';
        assistantApiResponseMainContent.style.top = '-5px';
        break;

      case 'Weather':
        assistantApiResponseContentRoot.style.transform = 'scale(0.7)';
        assistantApiResponseContentRoot.style.transformOrigin = 'top left';
        assistantApiResponseMainContent.style.left = '48px';
        assistantApiResponseMainContent.style.top = '24px';
        assistantApiResponseMainContent.style.width = 'calc(100vw * 1.28)';
        break;

      default:
        assistantApiResponseContentRoot.style.transform = 'scale(0.75)';
        assistantApiResponseContentRoot.style.transformOrigin = 'top left';
        assistantApiResponseMainContent.style.left = '48px';
        assistantApiResponseMainContent.style.top = '24px';
    }

    // Recursively remove unnecessary padding from the response
    if (responseType.responseType !== 'PhotoCarousel') {
      let lastElement = assistantApiResponseMainContent;

      while (lastElement != null) {
        lastElement.style.padding = '0';
        lastElement = lastElement.lastElementChild as HTMLElement;
      }
    }

    // Restore padding of the last forecast element in weather response
    if (responseType.responseType === 'Weather') {
      const weatherLastForcastElement = assistantApiResponseMainContent
        .querySelector('div:nth-child(3)')
        ?.lastElementChild;

      if (weatherLastForcastElement) {
        (<HTMLElement>weatherLastForcastElement).style.padding = '';
      }
    }
  }

  /**
   * Horizontally scrolls given element
   *
   * @param event
   * Scroll Event
   *
   * @param element
   * Element to be scrolled horizontally
   *
   * @param smoothScroll
   * Whether to set `scrollBehavior` to "smooth"
   */
  private static scrollHorizontally(
    event: WheelEvent,
    element: HTMLElement,
    smoothScroll: boolean,
  ) {
    const isPureVerticalScroll = event.deltaX === 0 && event.deltaY !== 0;
    const isAlmostVerticalScroll = Math.abs(event.deltaX) < Math.abs(event.deltaY);

    // Does not trigger on trackpad horizontal scroll
    if (isPureVerticalScroll || isAlmostVerticalScroll) {
      const delta = Math.max(-1, Math.min(1, event.deltaY || -event.detail));
      const scrollBehavior = smoothScroll ? 'smooth' : 'auto';
      const scrollOffset = 125;

      element.scrollBy({
        left: delta * scrollOffset,
        behavior: scrollBehavior,
      });

      event.preventDefault();
    }
  }

  /**
   * Registers horizontal scroll to given element
   * when mouse wheel event is triggered
   *
   * @param container
   * Container element for which the scroll has
   * to be mapped
   *
   * @param smoothScroll
   * Whether to set `scrollBehavior` to "smooth"
   */
  private static registerHorizontalScroll(container: HTMLElement, smoothScroll = false) {
    if (container) {
      container.onwheel = (event) => {
        AssistantResponseTransformer.scrollHorizontally(event, container, smoothScroll);
      };
    }
  }
}

export default AssistantResponseTransformer;
