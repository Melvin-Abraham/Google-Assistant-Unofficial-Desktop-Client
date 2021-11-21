import React from 'react';
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
    </div>
  );
}

export default QueryBar;
