import React, { useState } from 'react';
import Transcription from 'components/Transcription/Transcription';
import SuggestionChip, { SuggestionChipProps } from './SuggestionChip';
import './SuggestionsViewlet.scss';

export type Suggestions = SuggestionChipProps;

interface SuggestionsContainerProps {
  suggestions: Suggestions[];
}

function SuggestionsViewlet({ suggestions }: SuggestionsContainerProps) {
  const [isTranscriptionAvailable, setTranscriptionAvailability] = useState(false);

  return (
    <div className="suggestions-viewlet-root">
      <Transcription
        onTranscriptionAvailable={() => setTranscriptionAvailability(true)}
        onTranscriptionUnavailable={() => setTranscriptionAvailability(false)}
      />

      {(!isTranscriptionAvailable) && (
        <div className="suggestions-container">
          {suggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion.label}
              label={suggestion.label}
              LeadingIcon={suggestion.LeadingIcon}
              onClick={suggestion.onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SuggestionsViewlet;
