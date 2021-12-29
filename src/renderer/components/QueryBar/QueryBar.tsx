import React from 'react';
import AssistantMic from './AssistantMic/AssistantMic';
import './QueryBar.scss';

function QueryBar() {
  return (
    <div id="query-bar-root">
      <input
        role="searchbox"
        type="text"
        id="query-bar"
        placeholder="Ask me anything..."
      />

      <AssistantMic />
    </div>
  );
}

export default QueryBar;
