import React, { Component, Fragment } from 'react';
import ReactDOM from 'react-dom';

import CubePlaytestPage from './components/CubePlaytestPage';
import ErrorBoundary from './components/ErrorBoundary';

const wrapper = document.getElementById('react-root');
const element = <ErrorBoundary className="mt-3"><CubePlaytestPage {...reactProps} /></ErrorBoundary>;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
