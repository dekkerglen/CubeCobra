import { DisplayContextValue } from 'contexts/DisplayContext';


const defaultDisplayContext: DisplayContextValue = {
  cardsPerRow: 5,
  openCollapse: "",
  setCardsPerRow: jest.fn(),
  setOpenCollapse: jest.fn(),
  showCustomImages: false,
  toggleShowCustomImages: jest.fn(),
  showMaybeboard: false,
  toggleShowMaybeboard: jest.fn(),
  showInlineTagEmojis: false,
  toggleShowInlineTagEmojis: jest.fn()
};

export { defaultDisplayContext };