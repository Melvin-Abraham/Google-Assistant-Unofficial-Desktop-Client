import React from 'react';
import AssistantLogo from 'res/images/assistant_logo.svg?component';
import * as api from './utils/utils';
import './App.scss';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <AssistantLogo className="App-logo" fill="#ffffff" title="React Logo" />
        <p
          style={{
            backgroundColor: '#00000080',
          }}
        >
          This is the beginning of v2.0.0 development!
        </p>
        <div>
          <button
            onClick={() => api.window.closeWindow()}
            type="button"
          >
            Close this window
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
