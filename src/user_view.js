import React from 'react';
import ReactDOM from 'react-dom';

import UserViewPage from 'pages/UserViewPage';

const element = <UserViewPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
