import React, { useState } from 'react';

import { ChevronLeftIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import AboutViewContext from '../../contexts/AboutViewContext';
import AnalysisViewContext from '../../contexts/AnalysisViewContext';
import DisplayContext from '../../contexts/DisplayContext';
import PlaytestViewContext from '../../contexts/PlaytestViewContext';
import RecordsViewContext from '../../contexts/RecordsViewContext';
import { Flexbox } from '../base/Layout';

interface NavigationItem {
  label: string;
  href?: string;
  key: string;
  subItems?: NavigationItem[];
}

interface CubeSidebarProps {
  cube: Cube;
  activeLink: string;
  controls?: React.ReactNode;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'List',
    href: '/cube/list',
    key: 'list',
    subItems: [
      { label: 'Mainboard', key: 'mainboard' },
      { label: 'Maybeboard', key: 'maybeboard' },
    ],
  },
  {
    label: 'About',
    href: '/cube/about',
    key: 'about',
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
    subItems: [
      { label: 'Sample Pack', key: 'sample-pack' },
      { label: 'Practice Draft', key: 'practice-draft' },
      { label: 'Decks', key: 'decks' },
    ],
  },
  {
    label: 'Records',
    href: '/cube/records',
    key: 'records',
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

const CubeSidebar: React.FC<CubeSidebarProps> = ({ cube, activeLink, controls }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Check if activeLink matches any sub-item
  const isSubItemActive = (item: NavigationItem) => {
    if (item.subItems) {
      return item.subItems.some((subItem) => subItem.key === activeLink);
    }
    return false;
  };

  const { toggleShowMaybeboard, showMaybeboard } = React.useContext(DisplayContext);
  const aboutViewContext = React.useContext(AboutViewContext);
  const analysisViewContext = React.useContext(AnalysisViewContext);
  const playtestViewContext = React.useContext(PlaytestViewContext);
  const recordsViewContext = React.useContext(RecordsViewContext);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={classNames(
          'hidden sm:block bg-bg-accent border-r border-border transition-all duration-300 flex-shrink-0',
          {
            'w-64': isExpanded,
            'w-16 cursor-pointer hover:bg-bg-active': !isExpanded,
          },
        )}
        onClick={!isExpanded ? toggleSidebar : undefined}
      >
        {/* Navigation items */}
        <div className="sticky top-0 max-h-screen overflow-y-auto">
          {!isExpanded ? (
            <div className="h-full flex items-start justify-center pt-3">
              <ThreeBarsIcon size={20} className="text-text" />
            </div>
          ) : (
            <nav className="pb-64">
              <Flexbox direction="col" gap="0">
                {navigationItems.map((item, index) => {
                  const isActive = activeLink === item.key;
                  const isParentOfActive = isSubItemActive(item);
                  const fullHref = item.href ? `${item.href}/${encodeURIComponent(getCubeId(cube))}` : undefined;
                  // Only show sub-items when this section is active
                  const shouldShowSubItems = isActive || isParentOfActive;
                  const isFirstItem = index === 0;

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
                          <a href={fullHref} className="flex-1 text-base text-text">
                            <span
                              className={classNames({
                                'font-bold': isActive || isParentOfActive,
                                'font-semibold': !isActive && !isParentOfActive,
                              })}
                            >
                              {item.label}
                            </span>
                          </a>
                          {isFirstItem && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleSidebar();
                              }}
                              className="hover:bg-bg-active transition-colors p-1 rounded flex-shrink-0"
                              aria-label="Collapse sidebar"
                            >
                              <ChevronLeftIcon size={20} className="text-text" />
                            </button>
                          )}
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
                          <span
                            className={classNames('text-base text-text', {
                              'font-bold': isParentOfActive,
                              'font-semibold': !isParentOfActive,
                            })}
                          >
                            {item.label}
                          </span>
                        </div>
                      )}

                      {/* Show sub-items only when this section is active */}
                      {item.subItems && shouldShowSubItems && (
                        <div className="p-1">
                          <Flexbox direction="col" gap="1">
                            {item.subItems.map((subItem) => {
                              const isSubActive = activeLink === subItem.key;
                              let subFullHref: string | undefined;

                              if (subItem.href) {
                                subFullHref = `${subItem.href}/${encodeURIComponent(getCubeId(cube))}`;
                              }

                              // Special handling for List sub-items (Mainboard/Maybeboard)
                              if (item.key === 'list' && !subItem.href) {
                                const isMainboard = subItem.key === 'mainboard';
                                const boardParam = isMainboard ? 'mainboard' : 'maybeboard';
                                const listHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?board=${boardParam}`;

                                // Only show active state when on list page
                                const isActive =
                                  activeLink === 'list' && (isMainboard ? !showMaybeboard : showMaybeboard);

                                // If already on list page, toggle; otherwise navigate
                                const handleClick = (e: React.MouseEvent) => {
                                  if (activeLink === 'list') {
                                    e.preventDefault();
                                    toggleShowMaybeboard();
                                  }
                                };

                                return (
                                  <a
                                    key={subItem.key}
                                    href={listHref}
                                    onClick={handleClick}
                                    className={classNames(
                                      'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded cursor-pointer',
                                      {
                                        'bg-bg-active font-bold text-text': isActive,
                                        'font-normal text-text hover:bg-bg-active': !isActive,
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
                                      'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded cursor-pointer',
                                      {
                                        'bg-bg-active font-bold text-text': isActive,
                                        'font-normal text-text hover:bg-bg-active': !isActive,
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
                                      'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded cursor-pointer',
                                      {
                                        'bg-bg-active font-bold text-text': isActive,
                                        'font-normal text-text hover:bg-bg-active': !isActive,
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
                                      'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded cursor-pointer',
                                      {
                                        'bg-bg-active font-bold text-text': isActive,
                                        'font-normal text-text hover:bg-bg-active': !isActive,
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
                                      'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded cursor-pointer',
                                      {
                                        'bg-bg-active font-bold text-text': isActive,
                                        'font-normal text-text hover:bg-bg-active': !isActive,
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
                                        'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded',
                                        {
                                          'bg-bg-active font-bold text-text': isSubActive,
                                          'font-normal text-text hover:bg-bg-active': !isSubActive,
                                        },
                                      )}
                                    >
                                      {subItem.label}
                                    </a>
                                  ) : (
                                    <div
                                      className={classNames(
                                        'flex items-center pl-8 pr-4 py-1 transition-colors text-sm rounded',
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
            </nav>
          )}
        </div>
      </div>
    </>
  );
};

export default CubeSidebar;
