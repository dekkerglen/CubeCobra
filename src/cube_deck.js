import React from 'react';
import ReactDOM from 'react-dom';

import DraftDeck from './components/DraftDeck';
import ErrorBoundary from './components/ErrorBoundary';

const element = <ErrorBoundary className="mt-5"><DraftDeck {...reactProps} /></ErrorBoundary>;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
