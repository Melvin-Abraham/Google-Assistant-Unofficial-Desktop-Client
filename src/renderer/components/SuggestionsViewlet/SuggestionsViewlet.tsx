import React from 'react';
import SuggestionChip, { SuggestionChipProps } from './SuggestionChip';
import './SuggestionsViewlet.scss';

export type Suggestions = SuggestionChipProps;

interface SuggestionsContainerProps {
  suggestions: Suggestions[];
}

function SuggestionsViewlet({ suggestions }: SuggestionsContainerProps) {
  return (
    <div className="suggestions-viewlet-root">
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
    </div>
  );
}

export default SuggestionsViewlet;
