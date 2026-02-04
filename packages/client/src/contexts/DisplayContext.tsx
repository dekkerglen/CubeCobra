import React, { ReactNode, useCallback, useEffect, useState } from 'react';

import { NumCols } from '../components/base/Layout';
import useLocalStorage from '../hooks/useLocalStorage';
import useQueryParam from '../hooks/useQueryParam';
import Query from '../utils/Query';

export type RightSidebarMode = 'none' | 'edit' | 'sort';
export type RightSidebarPosition = 'right' | 'bottom';

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
  stacksPerRow: NumCols;
  setStacksPerRow: React.Dispatch<React.SetStateAction<NumCols>>;
  showDeckBuilderStatsPanel: boolean;
  toggleShowDeckBuilderStatsPanel: () => void;
  rightSidebarMode: RightSidebarMode;
  setRightSidebarMode: React.Dispatch<React.SetStateAction<RightSidebarMode>>;
  rightSidebarPosition: RightSidebarPosition;
  setRightSidebarPosition: React.Dispatch<React.SetStateAction<RightSidebarPosition>>;
  cubeSidebarExpanded: boolean;
  toggleCubeSidebarExpanded: () => void;
  showAllBoards: boolean;
  setShowAllBoards: React.Dispatch<React.SetStateAction<boolean>>;
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
  stacksPerRow: 2,
  setStacksPerRow: () => {},
  showDeckBuilderStatsPanel: false,
  toggleShowDeckBuilderStatsPanel: () => {},
  rightSidebarMode: 'none',
  setRightSidebarMode: () => {},
  rightSidebarPosition: 'right',
  setRightSidebarPosition: () => {},
  cubeSidebarExpanded: true,
  toggleCubeSidebarExpanded: () => {},
  showAllBoards: false,
  setShowAllBoards: () => {},
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
  const [stacksPerRow, setStacksPerRow] = useLocalStorage<NumCols>('stacksPerRow', 2);
  const [cubeSidebarExpanded, setCubeSidebarExpanded] = useLocalStorage<boolean>('cubeSidebarExpanded', true);
  const [rightSidebarPosition, setRightSidebarPosition] = useLocalStorage<RightSidebarPosition>(
    'rightSidebarPosition',
    'right',
  );

  const toggleShowCustomImages = useCallback(() => {
    setShowCustomImages((prev) => !prev);
  }, [setShowCustomImages]);

  const [boardParam, setBoardParam] = useQueryParam('board', 'mainboard');
  const [showMaybeboard, setShowMaybeboard] = useState<boolean>(boardParam === 'maybeboard');

  // Sync showMaybeboard with URL parameter
  useEffect(() => {
    setShowMaybeboard(boardParam === 'maybeboard');
  }, [boardParam]);

  const toggleShowMaybeboard = useCallback(() => {
    const newValue = !showMaybeboard;
    setShowMaybeboard(newValue);
    setBoardParam(newValue ? 'maybeboard' : 'mainboard');
  }, [showMaybeboard, setBoardParam]);

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

  const toggleCubeSidebarExpanded = useCallback(() => {
    setCubeSidebarExpanded((prev) => !prev);
  }, [setCubeSidebarExpanded]);

  const [showAllBoards, setShowAllBoards] = useLocalStorage<boolean>(`${cubeID}-showAllBoards`, false);

  const [rightSidebarMode, setRightSidebarMode] = useState<RightSidebarMode>(() => {
    // Check if there are pending changes in local storage
    if (typeof localStorage !== 'undefined' && cubeID) {
      try {
        const changesKey = `cubecobra-changes-${cubeID}`;
        const storedChanges = localStorage.getItem(changesKey);
        if (storedChanges) {
          const changes = JSON.parse(storedChanges);
          // Check if there are any pending edits
          const hasPendingEdits =
            Object.values(changes.mainboard || {}).some((c: any) => Array.isArray(c) && c.length > 0) ||
            Object.values(changes.maybeboard || {}).some((c: any) => Array.isArray(c) && c.length > 0);

          // Only auto-open the edit sidebar on desktop (md breakpoint: 768px)
          // On mobile, show a visual cue on the edit button instead
          if (hasPendingEdits && typeof window !== 'undefined' && window.innerWidth >= 768) {
            return 'edit';
          }
        }
      } catch (_e) {
        // If parsing fails, just use default
      }
    }
    return 'none';
  });

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
    stacksPerRow,
    setStacksPerRow,
    showDeckBuilderStatsPanel,
    toggleShowDeckBuilderStatsPanel,
    rightSidebarMode,
    setRightSidebarMode,
    rightSidebarPosition,
    setRightSidebarPosition,
    cubeSidebarExpanded,
    toggleCubeSidebarExpanded,
    showAllBoards,
    setShowAllBoards,
  };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
