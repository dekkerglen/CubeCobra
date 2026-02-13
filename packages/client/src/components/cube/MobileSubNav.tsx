import React, { useContext, useMemo } from 'react';

import Cube, { getViewDefinitions, viewNameToKey } from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import AboutViewContext from '../../contexts/AboutViewContext';
import AnalysisViewContext from '../../contexts/AnalysisViewContext';
import DisplayContext from '../../contexts/DisplayContext';
import PlaytestViewContext from '../../contexts/PlaytestViewContext';
import RecordsViewContext from '../../contexts/RecordsViewContext';

interface MobileSubNavProps {
  cube: Cube;
  activeLink: string;
}

interface SubNavItem {
  key: string;
  label: string;
  href?: string;
}

const MobileSubNav: React.FC<MobileSubNavProps> = ({ cube, activeLink }) => {
  const { activeView, setActiveView } = useContext(DisplayContext);
  const aboutViewContext = useContext(AboutViewContext);
  const analysisViewContext = useContext(AnalysisViewContext);
  const playtestViewContext = useContext(PlaytestViewContext);
  const recordsViewContext = useContext(RecordsViewContext);

  // Get view definitions for determining navigation
  const views = useMemo(() => getViewDefinitions(cube), [cube]);
  const viewKeys = useMemo(() => views.map((v) => viewNameToKey(v.name)), [views]);
  const viewSubItems = useMemo(
    () => views.map((view) => ({ key: viewNameToKey(view.name), label: view.name })),
    [views],
  );

  // Determine which subitems to show based on the active link
  let subItems: SubNavItem[] = [];
  let parentKey: string = '';

  // Define subitems for each parent category
  if (activeLink === 'list' || viewKeys.includes(activeLink)) {
    parentKey = 'list';
    subItems = viewSubItems;
  } else if (['about', 'primer', 'blog', 'changelog'].includes(activeLink)) {
    parentKey = 'about';
    subItems = [
      { key: 'primer', label: 'Primer' },
      { key: 'blog', label: 'Blog' },
      { key: 'changelog', label: 'Changelog' },
    ];
  } else if (['playtest', 'sample-pack', 'practice-draft', 'decks'].includes(activeLink)) {
    parentKey = 'playtest';
    subItems = [
      { key: 'practice-draft', label: 'Practice Draft' },
      { key: 'sample-pack', label: 'Sample Pack' },
      { key: 'decks', label: 'Decks' },
    ];
  } else if (['records', 'draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink)) {
    parentKey = 'records';
    subItems = [
      { key: 'draft-reports', label: 'Draft Reports' },
      { key: 'trophy-archive', label: 'Trophy Archive' },
      { key: 'winrate-analytics', label: 'Winrate Analytics' },
    ];
  } else if (
    ['analysis', 'averages', 'table', 'asfans', 'chart', 'recommender', 'playtest-data', 'tokens', 'combos'].includes(
      activeLink,
    )
  ) {
    parentKey = 'analysis';
    subItems = [
      { key: 'averages', label: 'Averages' },
      { key: 'table', label: 'Table' },
      { key: 'asfans', label: 'Asfans' },
      { key: 'chart', label: 'Chart' },
      { key: 'recommender', label: 'Recommender' },
      { key: 'playtest-data', label: 'Playtest Data' },
      { key: 'tokens', label: 'Tokens' },
      { key: 'combos', label: 'Combos' },
    ];
  }

  // If no subitems to show, don't render anything
  if (subItems.length === 0) {
    return null;
  }

  // Handle click for each subitem
  const handleSubItemClick = (e: React.MouseEvent, subItem: SubNavItem) => {
    // Don't do anything if clicking the already active tab
    if (isSubItemActive(subItem)) {
      e.preventDefault();
      return;
    }

    // Special handling for List sub-items (view navigation)
    if (parentKey === 'list') {
      e.preventDefault();
      setActiveView(subItem.label);
      return;
    }

    // Special handling for About sub-items
    if (parentKey === 'about' && aboutViewContext) {
      if (['about', 'primer', 'blog', 'changelog'].includes(activeLink)) {
        e.preventDefault();
        aboutViewContext.setView(subItem.key);
      }
      return;
    }

    // Special handling for Analysis sub-items
    if (parentKey === 'analysis' && analysisViewContext) {
      if (
        [
          'analysis',
          'averages',
          'table',
          'asfans',
          'chart',
          'recommender',
          'playtest-data',
          'tokens',
          'combos',
        ].includes(activeLink)
      ) {
        e.preventDefault();
        analysisViewContext.setView(subItem.key);
      }
      return;
    }

    // Special handling for Playtest sub-items
    if (parentKey === 'playtest' && playtestViewContext) {
      if (['playtest', 'sample-pack', 'practice-draft', 'decks'].includes(activeLink)) {
        e.preventDefault();
        playtestViewContext.setView(subItem.key);
      }
      return;
    }

    // Special handling for Records sub-items
    if (parentKey === 'records' && recordsViewContext) {
      if (['records', 'draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink)) {
        e.preventDefault();
        recordsViewContext.setView(subItem.key);
      }
      return;
    }
  };

  // Generate href for each subitem
  const getSubItemHref = (subItem: SubNavItem): string => {
    const cubeId = encodeURIComponent(getCubeId(cube));

    switch (parentKey) {
      case 'list': {
        // Use the view name for the URL param
        return `/cube/list/${cubeId}?view=${subItem.label}`;
      }
      case 'about':
        return `/cube/about/${cubeId}?view=${subItem.key}`;
      case 'playtest':
        return `/cube/playtest/${cubeId}?view=${subItem.key}`;
      case 'records':
        return `/cube/records/${cubeId}?view=${subItem.key}`;
      case 'analysis':
        return `/cube/analysis/${cubeId}?view=${subItem.key}`;
      default:
        return '#';
    }
  };

  // Determine if a subitem is active
  const isSubItemActive = (subItem: SubNavItem): boolean => {
    if (parentKey === 'list') {
      // For list view, check if this view's name matches the current active view
      return activeView === subItem.label;
    }
    return activeLink === subItem.key;
  };

  return (
    <nav className={classNames('md:hidden', 'bg-hero-bg -mt-px', 'overflow-x-auto overflow-y-hidden no-scrollbar')}>
      <div className="flex px-2 gap-1 min-w-max">
        {subItems.map((subItem) => {
          const isActive = isSubItemActive(subItem);
          const href = getSubItemHref(subItem);

          return (
            <a
              key={subItem.key}
              href={href}
              onClick={(e) => handleSubItemClick(e, subItem)}
              className={classNames('px-2 text-xs font-medium whitespace-nowrap', 'rounded-t-md', {
                'bg-bg text-text pt-1 pb-1': isActive,
                'bg-bg-active text-text-secondary hover:bg-bg hover:text-text pt-1 pb-1': !isActive,
              })}
            >
              {subItem.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileSubNav;
