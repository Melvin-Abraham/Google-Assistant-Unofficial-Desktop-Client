import React from 'react';
import gassist from 'gassist';
import './SuggestionChip.scss';

export interface SuggestionChipProps {
  /**
   * Icon component which is dispayed before the label
   */
  LeadingIcon?: React.ReactNode;

  /**
   * Label to be displayed on the chip
   */
  label: string;

  /**
   * Callback invoked when the chip is clicked. If undefined,
   * the `label` will be used as query to the assistant
   */
  onClick?: () => void;
}

function SuggestionChip({ LeadingIcon, label, onClick }: SuggestionChipProps) {
  const invokeAssistantWithQuery = () => gassist.assistant.invokeAssistant(label);

  return (
    <button
      aria-label={`${label} - Suggestion`}
      className="suggestion-chip"
      type="button"
      onClick={onClick ?? invokeAssistantWithQuery}
    >
      {LeadingIcon && (
        <div className="leading">
          { LeadingIcon }
        </div>
      )}

      { label }
    </button>
  );
}

export default SuggestionChip;
