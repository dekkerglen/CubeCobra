import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import { DisplayContextValue } from '../../../client/src/contexts/DisplayContext';

const defaultDisplayContext: DisplayContextValue = {
  cardsPerRow: 5,
  openCollapse: null,
  setCardsPerRow: jest.fn(),
  setOpenCollapse: jest.fn(),
  stacksPerRow: 2,
  setStacksPerRow: jest.fn(),
  showCustomImages: false,
  toggleShowCustomImages: jest.fn(),
  showMaybeboard: false,
  toggleShowMaybeboard: jest.fn(),
  displayOptions: { ...DEFAULT_CUBE_DISPLAY_OPTIONS, showTagQuickFilters: false },
  setDisplayOption: jest.fn(),
  displayOptionsModified: false,
  resetDisplayOptions: jest.fn(),
  saveDisplayOptions: jest.fn(),
  showDeckBuilderStatsPanel: false,
  toggleShowDeckBuilderStatsPanel: jest.fn(),
  rightSidebarMode: 'none',
  setRightSidebarMode: jest.fn(),
  rightSidebarPosition: 'right',
  setRightSidebarPosition: jest.fn(),
  cubeSidebarExpanded: true,
  toggleCubeSidebarExpanded: jest.fn(),
  activeBoard: 'mainboard',
  setActiveBoard: jest.fn(),
  activeView: 'Mainboard',
  setActiveView: jest.fn(),
};

export { defaultDisplayContext };
