import React from 'react';

import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import TouchBackend from 'react-dnd-touch-backend';

import { isTouchDevice } from '../utils/Util';

const backend = isTouchDevice() ? TouchBackend : HTML5Backend;

const DndProviderWithBackend = (props) => <DndProvider backend={backend} {...props} />;

export default DndProviderWithBackend;
