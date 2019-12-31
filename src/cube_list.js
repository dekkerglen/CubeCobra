import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CubeListPage from './components/CubeListPage';
import ErrorBoundary from './components/ErrorBoundary';

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary>
    <CubeListPage {...reactProps} />
  </ErrorBoundary>
);
wrapper && ReactDOM.render(element, wrapper);
