import { useEffect } from 'react';
import { useLottie } from 'lottie-react';
import assistantMicAnimationData from 'res/animations/assistant_mic_transition.json';
import './AssistantMicMain.scss';

interface AssistantMicProps {
  isMicActive: boolean;
  showListeningBar(): void;
  hideListeningBar(): void;
}

/**
 * Renders animated assistant microphone and controls
 * visibility of mic dots
 */
function AssistantMicMain({
  isMicActive,
  showListeningBar,
  hideListeningBar,
}: AssistantMicProps) {
  const assistantMicAnimationController = useLottie({
    animationData: assistantMicAnimationData,
    renderer: 'svg',
    loop: false,
    onComplete: () => {
      if (isMicActive) {
        showListeningBar();
      }
    },
  });

  useEffect(() => {
    if (isMicActive) {
      assistantMicAnimationController.setDirection(-1);
    }
    else {
      assistantMicAnimationController.setDirection(1);
      hideListeningBar();
    }

    assistantMicAnimationController.play();
  }, [isMicActive]);

  return assistantMicAnimationController.View;
}

export default AssistantMicMain;
