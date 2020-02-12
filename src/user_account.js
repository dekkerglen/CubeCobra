import React from 'react';
import ReactDOM from 'react-dom';

import UserAccountPage from 'pages/UserAccountPage';

const element = <UserAccountPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
