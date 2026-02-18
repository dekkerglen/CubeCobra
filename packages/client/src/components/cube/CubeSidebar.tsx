import React from 'react';

import {
  BookIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GearIcon,
  GraphIcon,
  ListUnorderedIcon,
  PlayIcon,
  TrophyIcon,
} from '@primer/octicons-react';
import Cube, { getViewDefinitions, viewNameToKey } from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import AboutViewContext from '../../contexts/AboutViewContext';
import AnalysisViewContext from '../../contexts/AnalysisViewContext';
import CubeContext from '../../contexts/CubeContext';
import DisplayContext from '../../contexts/DisplayContext';
import PlaytestViewContext from '../../contexts/PlaytestViewContext';
import RecordsViewContext from '../../contexts/RecordsViewContext';
import SettingsViewContext from '../../contexts/SettingsViewContext';
import UserContext from '../../contexts/UserContext';
import { Flexbox } from '../base/Layout';
import ScrollShadowContainer from '../base/ScrollShadowContainer';

interface NavigationItem {
  label: string;
  href?: string;
  key: string;
  icon?: React.ComponentType<any>;
  subItems?: NavigationItem[];
}

interface CubeSidebarProps {
  cube: Cube;
  activeLink: string;
  controls?: React.ReactNode;
}

// Generate navigation items dynamically based on cube's views
const getNavigationItems = (cube: Cube, isCubeOwner: boolean): NavigationItem[] => {
  const views = getViewDefinitions(cube);
  const viewSubItems = views.map((view) => ({
    label: view.name,
    key: viewNameToKey(view.name),
  }));

  const baseItems: NavigationItem[] = [
    {
      label: 'Menu',
      key: 'menu',
    },
    {
      label: 'List',
      href: '/cube/list',
      key: 'list',
      icon: ListUnorderedIcon,
      subItems: viewSubItems,
    },
    {
      label: 'About',
      href: '/cube/about',
      key: 'about',
      icon: BookIcon,
      subItems: [
        { label: 'Primer', key: 'primer' },
        { label: 'Blog', key: 'blog' },
        { label: 'Changelog', key: 'changelog' },
      ],
    },
    {
      label: 'Playtest',
      href: '/cube/playtest',
      key: 'playtest',
      icon: PlayIcon,
      subItems: [
        { label: 'Practice Draft', key: 'practice-draft' },
        { label: 'Sample Pack', key: 'sample-pack' },
        { label: 'Decks', key: 'decks' },
      ],
    },
    {
      label: 'Records',
      href: '/cube/records',
      key: 'records',
      icon: TrophyIcon,
      subItems: [
        { label: 'Draft Reports', key: 'draft-reports' },
        { label: 'Trophy Archive', key: 'trophy-archive' },
        { label: 'Winrate Analytics', key: 'winrate-analytics' },
      ],
    },
    {
      label: 'Analysis',
      href: '/cube/analysis',
      key: 'analysis',
      icon: GraphIcon,
      subItems: [
        { label: 'Averages', key: 'averages' },
        { label: 'Table', key: 'table' },
        { label: 'Asfans', key: 'asfans' },
        { label: 'Chart', key: 'chart' },
        { label: 'Recommender', key: 'recommender' },
        { label: 'Playtest Data', key: 'playtest-data' },
        { label: 'Tokens', key: 'tokens' },
        { label: 'Combos', key: 'combos' },
      ],
    },
  ];

  // Add Settings section only for cube owners
  if (isCubeOwner) {
    baseItems.push({
      label: 'Settings',
      href: '/cube/settings',
      key: 'settings',
      icon: GearIcon,
      subItems: [
        { label: 'Overview', key: 'overview' },
        { label: 'Options', key: 'options' },
        { label: 'Boards and Views', key: 'boards-and-views' },
        { label: 'Custom Sorts', key: 'custom-sorts' },
        { label: 'Draft Formats', key: 'draft-formats' },
        { label: 'Restore', key: 'restore' },
      ],
    });
  }

  return baseItems;
};

const CubeSidebar: React.FC<CubeSidebarProps> = ({ cube: _cubeProp, activeLink, controls }) => {
  // Use cube from context to pick up live updates (e.g., when views are modified)
  const { cube } = React.useContext(CubeContext);
  const user = React.useContext(UserContext);
  const isCubeOwner = !!user && cube.owner?.id === user.id;
  const navigationItems = React.useMemo(() => getNavigationItems(cube, isCubeOwner), [cube, isCubeOwner]);
  const { cubeSidebarExpanded, toggleCubeSidebarExpanded } = React.useContext(DisplayContext);
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = React.useState(false);
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0 });
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const iconRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Check if activeLink matches any sub-item
  const isSubItemActive = (item: NavigationItem) => {
    if (item.subItems) {
      return item.subItems.some((subItem) => subItem.key === activeLink);
    }
    return false;
  };

  const { activeView, setActiveView } = React.useContext(DisplayContext);
  const aboutViewContext = React.useContext(AboutViewContext);
  const analysisViewContext = React.useContext(AnalysisViewContext);
  const playtestViewContext = React.useContext(PlaytestViewContext);
  const recordsViewContext = React.useContext(RecordsViewContext);
  const settingsViewContext = React.useContext(SettingsViewContext);

  const toggleSidebar = () => {
    toggleCubeSidebarExpanded();
  };

  const handleItemMouseEnter = (itemKey: string, element: HTMLDivElement) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Calculate position relative to viewport
    const rect = element.getBoundingClientRect();
    setDropdownPosition({
      top: rect.top,
      left: rect.right + 8, // 8px gap (ml-2)
    });

    setHoveredItem(itemKey);
    setDropdownVisible(true);
  };

  const handleItemMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setDropdownVisible(false);
      setHoveredItem(null);
    }, 150);
  };

  const handleDropdownMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleDropdownMouseLeave = () => {
    setDropdownVisible(false);
    setHoveredItem(null);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={classNames(
          'hidden sm:block bg-bg-accent border-r border-border transition-all duration-300 flex-shrink-0',
          {
            'w-52': cubeSidebarExpanded,
            'w-16': !cubeSidebarExpanded,
          },
        )}
      >
        {/* Navigation items */}
        {!cubeSidebarExpanded ? (
          <div className="sticky top-0 max-h-screen overflow-visible">
            <nav className="pt-3">
              <Flexbox direction="col" gap="1" alignItems="center" className="overflow-visible">
                {/* Chevron icon at the top to expand */}
                <div
                  onClick={toggleSidebar}
                  className="cursor-pointer hover:bg-bg-active transition-colors rounded flex items-center justify-center w-12 h-12"
                  aria-label="Expand sidebar"
                >
                  <ChevronRightIcon size={20} className="text-text" />
                </div>
                {/* Parent navigation items with icons */}
                {navigationItems.map((item) => {
                  const isActive = activeLink === item.key;
                  const isParentOfActive = isSubItemActive(item);
                  const fullHref = item.href ? `${item.href}/${encodeURIComponent(getCubeId(cube))}` : undefined;
                  const IconComponent = item.icon;

                  if (!IconComponent || item.key === 'menu') return null;

                  return (
                    <div
                      key={item.key}
                      ref={(el) => (iconRefs.current[item.key] = el)}
                      onMouseEnter={(e) => handleItemMouseEnter(item.key, e.currentTarget)}
                      onMouseLeave={handleItemMouseLeave}
                    >
                      <a
                        href={fullHref}
                        className={classNames(
                          'flex items-center justify-center p-2 transition-colors rounded w-12 h-12',
                          {
                            'bg-bg-active text-text': isActive || isParentOfActive,
                            'text-text hover:bg-bg-active': !isActive && !isParentOfActive,
                          },
                        )}
                        aria-label={item.label}
                      >
                        <IconComponent size={20} />
                      </a>
                    </div>
                  );
                })}
              </Flexbox>
            </nav>
          </div>
        ) : (
          <div>
            <nav>
              <ScrollShadowContainer style={{ maxHeight: 'calc(100vh - 53px)' }}>
                <Flexbox direction="col" gap="0">
                  {navigationItems.map((item, _index) => {
                    const isActive = activeLink === item.key;
                    const isParentOfActive = isSubItemActive(item);
                    const fullHref = item.href ? `${item.href}/${encodeURIComponent(getCubeId(cube))}` : undefined;
                    // Always show sub-items
                    const shouldShowSubItems = true;
                    const isMenuHeader = item.key === 'menu';
                    const IconComponent = item.icon;

                    // Special handling for Menu header
                    if (isMenuHeader) {
                      return (
                        <div key={item.key}>
                          <div
                            onClick={toggleSidebar}
                            className="flex items-center justify-between px-4 py-1.5 transition-colors relative hover:bg-bg-active cursor-pointer"
                          >
                            <span className="text-base text-text font-bold">{item.label}</span>
                            <div className="p-1 rounded flex-shrink-0" aria-label="Collapse sidebar">
                              <ChevronLeftIcon size={20} className="text-text" />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={item.key}>
                        {fullHref ? (
                          <div
                            className={classNames(
                              'flex items-center justify-between px-4 py-1.5 transition-colors relative',
                              'hover:bg-bg-active',
                              {
                                'bg-bg-active border-l-4 border-transparent': isActive || isParentOfActive,
                                'border-l-4 border-transparent': !isActive && !isParentOfActive,
                              },
                            )}
                          >
                            <a href={fullHref} className="flex-1 flex items-center gap-2 text-base text-text">
                              {IconComponent && <IconComponent size={16} />}
                              <span
                                className={classNames({
                                  'font-bold': isActive || isParentOfActive,
                                  'font-semibold': !isActive && !isParentOfActive,
                                })}
                              >
                                {item.label}
                              </span>
                            </a>
                          </div>
                        ) : (
                          <div
                            className={classNames(
                              'flex items-center justify-between px-4 py-1.5 transition-colors relative',
                              'hover:bg-bg-active',
                              {
                                'bg-bg-active border-l-4 border-transparent': isParentOfActive,
                                'border-l-4 border-transparent': !isParentOfActive,
                              },
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {IconComponent && <IconComponent size={16} />}
                              <span
                                className={classNames('text-base text-text', {
                                  'font-bold': isParentOfActive,
                                  'font-semibold': !isParentOfActive,
                                })}
                              >
                                {item.label}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Show sub-items only when this section is active */}
                        {item.subItems && shouldShowSubItems && (
                          <div>
                            <Flexbox direction="col" gap="0">
                              {item.subItems.map((subItem) => {
                                const isSubActive = activeLink === subItem.key;
                                let subFullHref: string | undefined;

                                if (subItem.href) {
                                  subFullHref = `${subItem.href}/${encodeURIComponent(getCubeId(cube))}`;
                                }

                                // Special handling for List sub-items (view navigation)
                                if (item.key === 'list' && !subItem.href) {
                                  const viewKey = subItem.key;
                                  const listHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.label}`;

                                  // View is active if activeView matches
                                  const isActive = activeLink === 'list' && activeView === subItem.label;

                                  // If already on list page, change view; otherwise navigate
                                  const handleClick = (e: React.MouseEvent) => {
                                    if (activeLink === 'list') {
                                      e.preventDefault();
                                      setActiveView(subItem.label);
                                    }
                                  };

                                  return (
                                    <a
                                      key={viewKey}
                                      href={listHref}
                                      onClick={handleClick}
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm cursor-pointer hover:bg-bg-active',
                                        {
                                          'bg-bg-active font-bold text-text': isActive,
                                          'font-normal text-text': !isActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  );
                                }

                                // Special handling for Records sub-items
                                if (item.key === 'records' && !subItem.href) {
                                  const recordsHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                                  const isActive = activeLink === subItem.key;

                                  const handleClick = (e: React.MouseEvent) => {
                                    // If already on records page, update view via context
                                    if (
                                      recordsViewContext &&
                                      (activeLink === 'records' ||
                                        ['draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink))
                                    ) {
                                      e.preventDefault();
                                      recordsViewContext.setView(subItem.key);
                                    }
                                  };

                                  return (
                                    <a
                                      key={subItem.key}
                                      href={recordsHref}
                                      onClick={handleClick}
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm cursor-pointer hover:bg-bg-active',
                                        {
                                          'bg-bg-active font-bold text-text': isActive,
                                          'font-normal text-text': !isActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  );
                                }

                                // Special handling for About sub-items
                                if (item.key === 'about' && !subItem.href) {
                                  const aboutHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                                  const isActive = activeLink === subItem.key;

                                  const handleClick = (e: React.MouseEvent) => {
                                    // If already on about page, update view via context
                                    if (
                                      aboutViewContext &&
                                      (activeLink === 'about' || ['primer', 'blog', 'changelog'].includes(activeLink))
                                    ) {
                                      e.preventDefault();
                                      aboutViewContext.setView(subItem.key);
                                    }
                                  };

                                  return (
                                    <a
                                      key={subItem.key}
                                      href={aboutHref}
                                      onClick={handleClick}
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm cursor-pointer hover:bg-bg-active',
                                        {
                                          'bg-bg-active font-bold text-text': isActive,
                                          'font-normal text-text': !isActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  );
                                }

                                // Special handling for Playtest sub-items
                                if (item.key === 'playtest' && !subItem.href) {
                                  const playtestHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                                  const isActive = activeLink === subItem.key;

                                  const handleClick = (e: React.MouseEvent) => {
                                    // If already on playtest page, update view via context
                                    if (
                                      playtestViewContext &&
                                      (activeLink === 'playtest' ||
                                        ['sample-pack', 'practice-draft', 'decks'].includes(activeLink))
                                    ) {
                                      e.preventDefault();
                                      playtestViewContext.setView(subItem.key);
                                    }
                                  };

                                  return (
                                    <a
                                      key={subItem.key}
                                      href={playtestHref}
                                      onClick={handleClick}
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm cursor-pointer hover:bg-bg-active',
                                        {
                                          'bg-bg-active font-bold text-text': isActive,
                                          'font-normal text-text': !isActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  );
                                }

                                // Special handling for Analysis sub-items
                                if (item.key === 'analysis' && !subItem.href) {
                                  const analysisHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                                  const isActive = activeLink === subItem.key;

                                  const handleClick = (e: React.MouseEvent) => {
                                    // If already on analysis page, update view via context
                                    if (
                                      analysisViewContext &&
                                      (activeLink === 'analysis' ||
                                        [
                                          'averages',
                                          'table',
                                          'asfans',
                                          'chart',
                                          'recommender',
                                          'playtest-data',
                                          'tokens',
                                          'combos',
                                        ].includes(activeLink))
                                    ) {
                                      e.preventDefault();
                                      analysisViewContext.setView(subItem.key);
                                    }
                                  };

                                  return (
                                    <a
                                      key={subItem.key}
                                      href={analysisHref}
                                      onClick={handleClick}
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm cursor-pointer hover:bg-bg-active',
                                        {
                                          'bg-bg-active font-bold text-text': isActive,
                                          'font-normal text-text': !isActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  );
                                }

                                // Special handling for Settings sub-items
                                if (item.key === 'settings' && !subItem.href) {
                                  const settingsHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                                  const isActive = activeLink === subItem.key;

                                  const handleClick = (e: React.MouseEvent) => {
                                    // If already on settings page, update view via context
                                    if (
                                      settingsViewContext &&
                                      (activeLink === 'settings' ||
                                        ['overview', 'options', 'boards-and-views', 'custom-sorts', 'restore'].includes(
                                          activeLink,
                                        ))
                                    ) {
                                      e.preventDefault();
                                      settingsViewContext.setView(subItem.key);
                                    }
                                  };

                                  return (
                                    <a
                                      key={subItem.key}
                                      href={settingsHref}
                                      onClick={handleClick}
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm cursor-pointer hover:bg-bg-active',
                                        {
                                          'bg-bg-active font-bold text-text': isActive,
                                          'font-normal text-text': !isActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  );
                                }

                                return (
                                  <div key={subItem.key}>
                                    {subFullHref ? (
                                      <a
                                        href={subFullHref}
                                        className={classNames(
                                          'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm hover:bg-bg-active',
                                          {
                                            'bg-bg-active font-bold text-text': isSubActive,
                                            'font-normal text-text': !isSubActive,
                                          },
                                        )}
                                      >
                                        {subItem.label}
                                      </a>
                                    ) : (
                                      <div
                                        className={classNames(
                                          'flex items-center pl-8 pr-4 py-0.5 transition-colors text-sm',
                                          {
                                            'bg-bg-active font-bold text-text': isSubActive,
                                            'font-normal text-text': !isSubActive,
                                          },
                                        )}
                                      >
                                        {subItem.label}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </Flexbox>
                          </div>
                        )}

                        {/* Show controls as sub-items when this page is active */}
                        {isActive && controls && (
                          <div className="px-1">
                            <div className="px-4 py-1 text-sm">{controls}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Flexbox>
              </ScrollShadowContainer>
            </nav>
          </div>
        )}
      </div>

      {/* Fixed dropdown menu for collapsed sidebar */}
      {!cubeSidebarExpanded && dropdownVisible && hoveredItem && (
        <div
          onMouseEnter={handleDropdownMouseEnter}
          onMouseLeave={handleDropdownMouseLeave}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
          className={classNames(
            'bg-bg-accent border border-border rounded shadow-lg z-50 min-w-48',
            'animate-in fade-in slide-in-from-left-2 duration-150',
          )}
        >
          {navigationItems
            .filter((item) => item.key === hoveredItem)
            .map((item) => (
              <React.Fragment key={item.key}>
                <div className="px-4 py-2 border-b border-border">
                  <span className="text-sm font-bold text-text">{item.label}</span>
                </div>
                {item.subItems && (
                  <div className="py-1">
                    {item.subItems.map((subItem) => {
                      const isSubActive = activeLink === subItem.key;
                      let subHref: string | undefined;
                      let handleClick: ((e: React.MouseEvent) => void) | undefined;

                      // Handle different types of sub-items
                      if (item.key === 'list') {
                        subHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.label}`;

                        // View is active if activeView matches
                        const isViewActive = activeLink === 'list' && activeView === subItem.label;

                        // If already on list page, change view; otherwise navigate
                        handleClick = (e: React.MouseEvent) => {
                          if (activeLink === 'list') {
                            e.preventDefault();
                            setActiveView(subItem.label);
                          }
                        };

                        return (
                          <a
                            key={subItem.key}
                            href={subHref}
                            onClick={handleClick}
                            className={classNames(
                              'block px-4 py-1.5 text-sm cursor-pointer',
                              'hover:bg-bg-active transition-colors',
                              {
                                'bg-bg-active font-bold text-text': isViewActive,
                                'font-normal text-text': !isViewActive,
                              },
                            )}
                          >
                            {subItem.label}
                          </a>
                        );
                      } else if (item.key === 'records') {
                        subHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;

                        handleClick = (e: React.MouseEvent) => {
                          if (
                            recordsViewContext &&
                            (activeLink === 'records' ||
                              ['draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink))
                          ) {
                            e.preventDefault();
                            recordsViewContext.setView(subItem.key);
                          }
                        };
                      } else if (item.key === 'about') {
                        subHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;

                        handleClick = (e: React.MouseEvent) => {
                          if (
                            aboutViewContext &&
                            (activeLink === 'about' || ['primer', 'blog', 'changelog'].includes(activeLink))
                          ) {
                            e.preventDefault();
                            aboutViewContext.setView(subItem.key);
                          }
                        };
                      } else if (item.key === 'playtest') {
                        subHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;

                        handleClick = (e: React.MouseEvent) => {
                          if (
                            playtestViewContext &&
                            (activeLink === 'playtest' ||
                              ['sample-pack', 'practice-draft', 'decks'].includes(activeLink))
                          ) {
                            e.preventDefault();
                            playtestViewContext.setView(subItem.key);
                          }
                        };
                      } else if (item.key === 'analysis') {
                        subHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;

                        handleClick = (e: React.MouseEvent) => {
                          if (
                            analysisViewContext &&
                            (activeLink === 'analysis' ||
                              [
                                'averages',
                                'table',
                                'asfans',
                                'chart',
                                'recommender',
                                'playtest-data',
                                'tokens',
                                'combos',
                              ].includes(activeLink))
                          ) {
                            e.preventDefault();
                            analysisViewContext.setView(subItem.key);
                          }
                        };
                      } else if (item.key === 'settings') {
                        subHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;

                        handleClick = (e: React.MouseEvent) => {
                          if (
                            settingsViewContext &&
                            (activeLink === 'settings' ||
                              ['overview', 'options', 'boards-and-views', 'custom-sorts', 'restore'].includes(
                                activeLink,
                              ))
                          ) {
                            e.preventDefault();
                            settingsViewContext.setView(subItem.key);
                          }
                        };
                      } else if (subItem.href) {
                        subHref = `${subItem.href}/${encodeURIComponent(getCubeId(cube))}`;
                      }

                      return (
                        <a
                          key={subItem.key}
                          href={subHref}
                          onClick={handleClick}
                          className={classNames(
                            'block px-4 py-1.5 text-sm transition-colors hover:bg-bg-active cursor-pointer',
                            {
                              'bg-bg-active font-bold text-text': isSubActive,
                              'font-normal text-text': !isSubActive,
                            },
                          )}
                        >
                          {subItem.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            ))}
        </div>
      )}
    </>
  );
};

export default CubeSidebar;
