import React, { ReactNode, useCallback, useState } from 'react';

import { NumCols } from '../components/base/Layout';
import useLocalStorage from '../hooks/useLocalStorage';
import Query from '../utils/Query';

export interface DisplayContextValue {
  showCustomImages: boolean;
  toggleShowCustomImages: () => void;
  showMaybeboard: boolean;
  showInlineTagEmojis: boolean;
  toggleShowMaybeboard: () => void;
  toggleShowInlineTagEmojis: () => void;
  openCollapse: string | null;
  setOpenCollapse: React.Dispatch<React.SetStateAction<string | null>>;
  cardsPerRow: NumCols;
  setCardsPerRow: React.Dispatch<React.SetStateAction<NumCols>>;
  showDeckBuilderStatsPanel: boolean;
  toggleShowDeckBuilderStatsPanel: () => void;
}

const DisplayContext = React.createContext<DisplayContextValue>({
  showCustomImages: true,
  showMaybeboard: false,
  showInlineTagEmojis: false,
  toggleShowCustomImages: () => {},
  toggleShowMaybeboard: () => {},
  toggleShowInlineTagEmojis: () => {},
  openCollapse: null,
  setOpenCollapse: () => {},
  cardsPerRow: 8,
  setCardsPerRow: () => {},
  showDeckBuilderStatsPanel: false,
  toggleShowDeckBuilderStatsPanel: () => {},
});

interface DisplayContextProviderProps {
  cubeID: string;
  children: ReactNode;
}

export const DisplayContextProvider: React.FC<DisplayContextProviderProps> = ({ cubeID, ...props }) => {
  const [showCustomImages, setShowCustomImages] = useLocalStorage<boolean>('showcustomimages', true);
  const [openCollapse, setOpenCollapse] = useState<string | null>(() => {
    return Query.get('f') ? 'filter' : null;
  });
  const [cardsPerRow, setCardsPerRow] = useLocalStorage<NumCols>('cardsPerRow', 6);

  const toggleShowCustomImages = useCallback(() => {
    setShowCustomImages((prev) => !prev);
  }, [setShowCustomImages]);

  const [showMaybeboard, setShowMaybeboard] = useState<boolean>(() => {
    return (
      typeof localStorage !== 'undefined' &&
      typeof cubeID === 'string' &&
      localStorage.getItem(`maybeboard-${cubeID}`) === 'true'
    );
  });
  const toggleShowMaybeboard = useCallback(() => {
    if (cubeID) localStorage.setItem(`maybeboard-${cubeID}`, (!showMaybeboard).toString());
    setShowMaybeboard((prev) => !prev);
  }, [cubeID, showMaybeboard]);

  const [showInlineTagEmojis, setShowInlineTagEmojis] = useState<boolean>(() => {
    return (
      typeof localStorage !== 'undefined' &&
      typeof cubeID === 'string' &&
      localStorage.getItem(`inline-tag-emojis-${cubeID}`) === 'true'
    );
  });

  const [showDeckBuilderStatsPanel, setShowDeckBuilderStatsPanel] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('show-deckbuilder-stats') === 'true';
  });

  const toggleShowInlineTagEmojis = useCallback(() => {
    if (cubeID) localStorage.setItem(`inline-tag-emojis-${cubeID}`, (!showInlineTagEmojis).toString());
    setShowInlineTagEmojis((prev) => !prev);
  }, [cubeID, showInlineTagEmojis]);

  const toggleShowDeckBuilderStatsPanel = useCallback(() => {
    localStorage.setItem('show-deckbuilder-stats', (!showDeckBuilderStatsPanel).toString());
    setShowDeckBuilderStatsPanel((prev) => !prev);
  }, [showDeckBuilderStatsPanel]);

  const value: DisplayContextValue = {
    showCustomImages,
    toggleShowCustomImages,
    showMaybeboard,
    toggleShowMaybeboard,
    showInlineTagEmojis,
    toggleShowInlineTagEmojis,
    openCollapse,
    setOpenCollapse,
    cardsPerRow,
    setCardsPerRow,
    showDeckBuilderStatsPanel,
    toggleShowDeckBuilderStatsPanel,
  };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
