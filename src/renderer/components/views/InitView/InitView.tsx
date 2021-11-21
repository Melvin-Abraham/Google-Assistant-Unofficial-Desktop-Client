import React from 'react';
import AssistantLogoClear from 'res/images/assistant_logo_clear.svg?component';
import './InitView.scss';

function InitView() {
  return (
    <div className="initview-root">
      <AssistantLogoClear className="logo" />

      <h1 className="initview-message">
        Hi! How can I help?
      </h1>
    </div>
  );
}

export default InitView;
