import React from 'react';
import ReactDOM from 'react-dom';

import UserDecksPage from 'pages/UserDecksPage';

const element = <UserDecksPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
