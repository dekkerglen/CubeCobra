import React from 'react';
import ReactDOM from 'react-dom';

import UserSocialPage from 'pages/UserSocialPage';

const element = <UserSocialPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
