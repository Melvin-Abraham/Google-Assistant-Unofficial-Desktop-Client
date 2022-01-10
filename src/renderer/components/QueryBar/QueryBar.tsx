import React, { useState } from 'react';
import gassist from 'gassist';
import AssistantMic from 'components/AssistantMic/AssistantMic';
import './QueryBar.scss';

function QueryBar() {
  const [textQuery, setTextQuery] = useState('');

  return (
    <div id="query-bar-root">
      <input
        role="searchbox"
        type="text"
        id="query-bar"
        placeholder="Ask me anything..."
        value={textQuery}
        onChange={(event) => {
          const query = event.target.value;
          setTextQuery(query);
        }}
        onKeyPress={(event) => {
          if (event.key === 'Enter') {
            // Send the query to assistant
            gassist.assistant.invokeAssistant(textQuery);

            // Reset the query bar text
            setTextQuery('');
          }
        }}
      />

      <AssistantMic />
    </div>
  );
}

export default QueryBar;
