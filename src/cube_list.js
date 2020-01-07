import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CubeListPage from './components/CubeListPage';
import ErrorBoundary from './components/ErrorBoundary';

const wrapper = document.getElementById('react-root');
const element = <CubeListPage {...reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
