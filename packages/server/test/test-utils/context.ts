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
  showInlineTagEmojis: false,
  toggleShowInlineTagEmojis: jest.fn(),
  showDeckBuilderStatsPanel: false,
  toggleShowDeckBuilderStatsPanel: jest.fn(),
  rightSidebarMode: 'none',
  setRightSidebarMode: jest.fn(),
  rightSidebarPosition: 'right',
  setRightSidebarPosition: jest.fn(),
  cubeSidebarExpanded: true,
  toggleCubeSidebarExpanded: jest.fn(),
  showAllBoards: false,
  setShowAllBoards: jest.fn(),
  activeBoard: 'mainboard',
  setActiveBoard: jest.fn(),
};

export { defaultDisplayContext };
