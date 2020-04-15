import React from 'react';
import ReactDOM from 'react-dom';

import SamplePackPage from 'pages/SamplePackPage';

const wrapper = document.getElementById('react-root');
const element = <SamplePackPage {...window.reactProps} />;
ReactDOM.hydrate(element, wrapper);
