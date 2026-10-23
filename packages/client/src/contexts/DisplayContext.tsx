import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  CUBE_DISPLAY_OPTION_KEYS,
  CubeDisplayOptions,
  DEFAULT_CUBE_DISPLAY_OPTIONS,
  viewNameToSlug,
} from '@utils/datatypes/Cube';

import { NumCols } from '../components/base/Layout';
import useLocalStorage from '../hooks/useLocalStorage';
import useQueryParam from '../hooks/useQueryParam';
import Query from '../utils/Query';
import { CSRFContext } from './CSRFContext';

export type RightSidebarMode = 'none' | 'edit' | 'sort';
export type RightSidebarPosition = 'right' | 'bottom';

export interface DisplayContextValue {
  showCustomImages: boolean;
  toggleShowCustomImages: () => void;
  showMaybeboard: boolean;
  activeBoard: string; // Deprecated - use activeView instead
  setActiveBoard: (board: string) => void; // Deprecated - use setActiveView instead
  activeView: string; // The currently active view, as its URL slug
  setActiveView: (view: string) => void;
  displayView: string; // How cards are drawn: table, spoiler, curve, stacks, list
  setDisplayView: (view: string) => void;
  toggleShowMaybeboard: () => void;
  displayOptions: CubeDisplayOptions;
  setDisplayOption: <K extends keyof CubeDisplayOptions>(key: K, value: CubeDisplayOptions[K]) => void;
  displayOptionsModified: boolean;
  resetDisplayOptions: () => void;
  saveDisplayOptions: () => Promise<boolean>;
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
}

const DisplayContext = React.createContext<DisplayContextValue>({
  showCustomImages: true,
  showMaybeboard: false,
  activeBoard: 'mainboard',
  setActiveBoard: () => {},
  activeView: 'mainboard',
  setActiveView: () => {},
  displayView: 'table',
  setDisplayView: () => {},
  toggleShowCustomImages: () => {},
  toggleShowMaybeboard: () => {},
  displayOptions: DEFAULT_CUBE_DISPLAY_OPTIONS,
  setDisplayOption: () => {},
  displayOptionsModified: false,
  resetDisplayOptions: () => {},
  saveDisplayOptions: async () => false,
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
});

interface DisplayContextProviderProps {
  cubeID: string;
  /**
   * URL slugs of the cube's views, in display order. The first is the default view,
   * and a `view` param outside this list is treated as unresolvable.
   */
  viewSlugs?: string[];
  /**
   * When true, the right sidebar defaults to 'edit' on desktop. Used by the
   * cube list page so owners always see the edit panel expanded on desktop.
   */
  defaultEditSidebarOpen?: boolean;
  /** The cube's saved display defaults; every page load starts from these. */
  savedDisplayOptions?: CubeDisplayOptions;
  /** Default display (table, spoiler, …) per view slug; views without one use table. */
  displayViewDefaults?: Record<string, string>;
  children: ReactNode;
}

export const DisplayContextProvider: React.FC<DisplayContextProviderProps> = ({
  cubeID,
  viewSlugs,
  defaultEditSidebarOpen = false,
  savedDisplayOptions: initialSavedDisplayOptions = DEFAULT_CUBE_DISPLAY_OPTIONS,
  displayViewDefaults,
  ...props
}) => {
  const { csrfFetch } = useContext(CSRFContext);
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

  // View-based navigation. The `view` query param is the single source of truth and
  // carries the view's slug; activeView is derived from it rather than mirrored into
  // state, so the URL and the active view can never disagree.
  const defaultViewSlug = viewSlugs?.[0] || 'mainboard';
  const [viewParam, setViewParam] = useQueryParam('view', defaultViewSlug);

  // Slugify on read so links predating slug navigation (which carried the display
  // name, e.g. "?view=Base Packs") still land on the right view.
  const requestedViewSlug = viewNameToSlug(viewParam);
  const isKnownView = !viewSlugs || viewSlugs.length === 0 || viewSlugs.includes(requestedViewSlug);
  const activeView = isKnownView && requestedViewSlug ? requestedViewSlug : defaultViewSlug;

  // A param naming no existing view (a typo, a renamed view, a stale double-encoded
  // link) falls back to the default view. Drop it with a history *replace* first:
  // letting setViewParam push would put the broken URL one Back press away, and
  // re-clearing it on return would trap the button.
  useEffect(() => {
    if (isKnownView) {
      return;
    }
    Query.del('view');
    setViewParam(defaultViewSlug);
  }, [isKnownView, defaultViewSlug, setViewParam]);

  const setActiveView = useCallback(
    (view: string) => {
      setViewParam(viewNameToSlug(view));
    },
    [setViewParam],
  );

  const [displayView, setDisplayView] = useQueryParam('display', displayViewDefaults?.[activeView] || 'table');

  // Legacy board-based navigation (deprecated - for backwards compatibility)
  const [boardParam, setBoardParam] = useQueryParam('board', 'mainboard');
  const [showMaybeboard, setShowMaybeboard] = useState<boolean>(boardParam === 'maybeboard');
  const [activeBoard, setActiveBoardState] = useState<string>(boardParam);

  // Sync showMaybeboard and activeBoard with URL parameter
  useEffect(() => {
    setShowMaybeboard(boardParam === 'maybeboard');
    setActiveBoardState(boardParam);
  }, [boardParam]);

  const toggleShowMaybeboard = useCallback(() => {
    const newValue = !showMaybeboard;
    setShowMaybeboard(newValue);
    const newBoard = newValue ? 'maybeboard' : 'mainboard';
    setActiveBoardState(newBoard);
    setBoardParam(newBoard);
  }, [showMaybeboard, setBoardParam]);

  const setActiveBoard = useCallback(
    (board: string) => {
      setActiveBoardState(board);
      setShowMaybeboard(board === 'maybeboard');
      setBoardParam(board);
    },
    [setBoardParam],
  );

  const [savedDisplayOptions, setSavedDisplayOptions] = useState<CubeDisplayOptions>(initialSavedDisplayOptions);
  const [displayOptions, setDisplayOptions] = useState<CubeDisplayOptions>(initialSavedDisplayOptions);

  const setDisplayOption = useCallback(<K extends keyof CubeDisplayOptions>(key: K, value: CubeDisplayOptions[K]) => {
    setDisplayOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const displayOptionsModified = useMemo(
    () => CUBE_DISPLAY_OPTION_KEYS.some((key) => displayOptions[key] !== savedDisplayOptions[key]),
    [displayOptions, savedDisplayOptions],
  );

  const resetDisplayOptions = useCallback(() => {
    setDisplayOptions(savedDisplayOptions);
  }, [savedDisplayOptions]);

  const saveDisplayOptions = useCallback(async () => {
    try {
      const response = await csrfFetch(`/cube/api/savedisplayoptions/${cubeID}`, {
        method: 'POST',
        body: JSON.stringify({ displayOptions }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        return false;
      }
      setSavedDisplayOptions(displayOptions);
      return true;
    } catch {
      return false;
    }
  }, [csrfFetch, cubeID, displayOptions]);

  const [showDeckBuilderStatsPanel, setShowDeckBuilderStatsPanel] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('show-deckbuilder-stats') === 'true';
  });

  const toggleShowDeckBuilderStatsPanel = useCallback(() => {
    localStorage.setItem('show-deckbuilder-stats', (!showDeckBuilderStatsPanel).toString());
    setShowDeckBuilderStatsPanel((prev) => !prev);
  }, [showDeckBuilderStatsPanel]);

  const toggleCubeSidebarExpanded = useCallback(() => {
    setCubeSidebarExpanded((prev) => !prev);
  }, [setCubeSidebarExpanded]);

  const [rightSidebarMode, setRightSidebarMode] = useState<RightSidebarMode>(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

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
          if (hasPendingEdits && isDesktop) {
            return 'edit';
          }
        }
      } catch (_e) {
        // If parsing fails, just use default
      }
    }

    // For owned cube list views on desktop, always default the edit sidebar to expanded
    if (defaultEditSidebarOpen && isDesktop) {
      return 'edit';
    }
    return 'none';
  });

  const value: DisplayContextValue = {
    showCustomImages,
    toggleShowCustomImages,
    showMaybeboard,
    activeBoard,
    setActiveBoard,
    activeView,
    setActiveView,
    displayView,
    setDisplayView,
    toggleShowMaybeboard,
    displayOptions,
    setDisplayOption,
    displayOptionsModified,
    resetDisplayOptions,
    saveDisplayOptions,
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
  };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
