import { DisplayContextValue } from '../../../client/src/contexts/DisplayContext';

const defaultDisplayContext: DisplayContextValue = {
  cardsPerRow: 5,
  openCollapse: '',
  setCardsPerRow: jest.fn(),
  setOpenCollapse: jest.fn(),
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
};

export { defaultDisplayContext };
