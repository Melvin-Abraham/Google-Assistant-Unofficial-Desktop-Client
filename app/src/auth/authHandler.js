const path = require('path');
const express = require('express');
const electron = require('electron');

const app = express();
const port = 5754;
const authHandleRedirectUri = '/auth/handler';
const authSuccessPath = '/auth/success';

const authSuccessPageServePath = path.join(__dirname, 'authSuccess');
const authSuccessPageStaticServeRequestHandler = express.static(authSuccessPageServePath);

app.use(authSuccessPath, authSuccessPageStaticServeRequestHandler);

app.get(authHandleRedirectUri, (req, res) => {
  const { query } = req;
  const authCode = query.code;

  const getTokenView = document.querySelector('[name=get-token]');

  // If "Get Token" screen is currently not the active view
  // No need to do anything
  if (getTokenView === null) {
    res.send('Invalid auth session. "Get Token" screen is not active...');
    return;
  }

  // If auth code is not a part of URL query, do nothing
  if (authCode === undefined) {
    res.send('No auth code provided for authorization');
    return;
  }

  /** @type {HTMLInputElement} */
  const authCodeInputField = getTokenView.querySelector('#auth-code-input');
  authCodeInputField.value = authCode;

  const suggestionArea = document.querySelector('#suggestion-area');

  /** @type {HTMLButtonElement} */
  const submitAuthCodeButton = suggestionArea.querySelector('#submit-btn');
  submitAuthCodeButton.click();

  // Let the user know that the auth was successful
  res.redirect(authSuccessPath);

  // Bring assistant window to the foreground
  const assistantWindow = electron.remote.getCurrentWindow();
  assistantWindow.show();
});

app.listen(port, () => {
  console.log(`Auth handler listener started in port: ${port}`);
});
