import React from 'react';
import './AssistantContainer.scss';

export type BorderType = |
  'none' |
  'minimal' |
  'prominent'

interface AssistantContainerProps {
  children: React.ReactNode;
  borderType?: BorderType;
}

/**
 * Root-level component for containing children components
 * @param assistantContainerProps
 */
function AssistantContainer({ children, borderType = 'minimal' }: AssistantContainerProps) {
  return (
    <div className="assistant-root-container" data-border-type={borderType}>
      {children}
    </div>
  );
}

export default AssistantContainer;
