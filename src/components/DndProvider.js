import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import TouchBackend from 'react-dnd-touch-backend';

import { isTouchDevice } from '../util/Util';

const DndProviderWithBackend = (props) => (
  <DndProvider backend={isTouchDevice() ? TouchBackend : HTML5Backend} {...props} />
);

export default DndProviderWithBackend;
