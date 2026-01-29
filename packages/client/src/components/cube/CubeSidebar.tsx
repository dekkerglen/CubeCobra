import React, { useState } from 'react';

import { ChevronLeftIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import AnalysisViewContext from '../../contexts/AnalysisViewContext';
import DisplayContext from '../../contexts/DisplayContext';
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
    key: 'about',
    subItems: [
      { label: 'Primer', href: '/cube/primer', key: 'primer' },
      { label: 'Blog', href: '/cube/blog', key: 'blog' },
      { label: 'Changelog', href: '/cube/changelog', key: 'changelog' },
    ],
  },
  { label: 'Playtest', href: '/cube/playtest', key: 'playtest' },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasMobileAd, setHasMobileAd] = useState(false);
  const { toggleShowMaybeboard, showMaybeboard } = React.useContext(DisplayContext);
  const analysisViewContext = React.useContext(AnalysisViewContext);
  const recordsViewContext = React.useContext(RecordsViewContext);

  // Track if mobile ad is actually rendered in DOM
  React.useEffect(() => {
    const checkForAd = () => {
      // Check for the mobile-banner element created by NitroAds
      const mobileBanner = document.getElementById('mobile-banner');
      const hasAd = mobileBanner !== null && mobileBanner.offsetHeight > 0;

      setHasMobileAd(hasAd);
    };

    // Check immediately
    checkForAd();

    // Check periodically for ad appearance (NitroAds loads async)
    const interval = setInterval(checkForAd, 500);

    // Also check on window resize (mobile breakpoint changes)
    window.addEventListener('resize', checkForAd);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', checkForAd);
    };
  }, []);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Check if activeLink matches any sub-item
  const isSubItemActive = (item: NavigationItem) => {
    if (item.subItems) {
      return item.subItems.some((subItem) => subItem.key === activeLink);
    }
    return false;
  };

  return (
    <>
      {/* Mobile toggle button - fixed in bottom left corner, fully sticky, with spacing for mobile ad when shown */}
      <button
        onClick={toggleMobileMenu}
        className={classNames(
          'lg:hidden fixed left-4 z-30 bg-bg-secondary hover:bg-bg-active p-3 rounded-lg shadow-lg transition-all border border-border',
          hasMobileAd ? 'bottom-20' : 'bottom-4',
        )}
        aria-label="Toggle navigation menu"
      >
        <ThreeBarsIcon size={24} className="text-white" />
      </button>

      {/* Mobile backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar - only visible on mobile */}
      <div
        className={classNames(
          'lg:hidden bg-bg-accent border-r border-border transition-transform duration-300 flex-shrink-0',
          'fixed top-0 left-0 h-full z-50 w-64 transform',
          {
            'translate-x-0': isMobileMenuOpen,
            '-translate-x-full': !isMobileMenuOpen,
          },
        )}
      >
        {/* Navigation items */}
        <div className="sticky top-0 max-h-screen overflow-y-auto">
          <nav>
            <Flexbox direction="col" gap="0">
              {navigationItems.map((item, index) => {
                const isActive = activeLink === item.key;
                const isParentOfActive = isSubItemActive(item);
                const fullHref = item.href ? `${item.href}/${encodeURIComponent(getCubeId(cube))}` : undefined;

                const isFirstItem = index === 0;

                return (
                  <div key={item.key}>
                    {fullHref ? (
                      <a
                        href={fullHref}
                        className={classNames(
                          'flex items-center justify-between px-4 py-1.5 transition-colors relative',
                          'hover:bg-bg-active',
                          {
                            'bg-bg-active border-l-4 border-transparent': isActive || isParentOfActive,
                            'border-l-4 border-transparent': !isActive && !isParentOfActive,
                          },
                        )}
                      >
                        <span
                          className={classNames('text-base text-text', {
                            'font-bold': isActive || isParentOfActive,
                            'font-semibold': !isActive && !isParentOfActive,
                          })}
                        >
                          {item.label}
                        </span>
                        {isFirstItem && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              closeMobileMenu();
                            }}
                            className="hover:bg-bg-active transition-colors p-1 rounded flex-shrink-0"
                            aria-label="Close menu"
                          >
                            <ChevronLeftIcon size={20} className="text-text" />
                          </button>
                        )}
                      </a>
                    ) : (
                      <div
                        className={classNames(
                          'flex items-center justify-between px-4 py-1.5 transition-colors relative',
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

                    {/* Always show sub-items if they exist */}
                    {item.subItems && (
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
                                  closeMobileMenu();
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
                                // If already on a records page, update view via context
                                if (
                                  recordsViewContext &&
                                  (activeLink === 'records' ||
                                    ['draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink))
                                ) {
                                  e.preventDefault();
                                  recordsViewContext.setView(subItem.key);
                                  closeMobileMenu();
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

                            // Special handling for Analysis sub-items
                            if (item.key === 'analysis' && !subItem.href) {
                              const analysisHref = `${item.href}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                              const isActive = activeLink === subItem.key;

                              const handleClick = (e: React.MouseEvent) => {
                                // If already on an analysis page, update view via context
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
                                  closeMobileMenu();
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
        </div>
      </div>

      {/* Desktop Sidebar - only visible on desktop */}
      <div
        className={classNames(
          'hidden lg:block bg-bg-accent border-r border-border transition-all duration-300 flex-shrink-0',
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
            <nav>
              <Flexbox direction="col" gap="0">
                {navigationItems.map((item, index) => {
                  const isActive = activeLink === item.key;
                  const isParentOfActive = isSubItemActive(item);
                  const fullHref = item.href ? `${item.href}/${encodeURIComponent(getCubeId(cube))}` : undefined;

                  const isFirstItem = index === 0;

                  return (
                    <div key={item.key}>
                      {fullHref ? (
                        <a
                          href={fullHref}
                          className={classNames(
                            'flex items-center justify-between px-4 py-1.5 transition-colors relative',
                            'hover:bg-bg-active',
                            {
                              'bg-bg-active border-l-4 border-transparent': isActive || isParentOfActive,
                              'border-l-4 border-transparent': !isActive && !isParentOfActive,
                            },
                          )}
                        >
                          <span
                            className={classNames('text-base text-text', {
                              'font-bold': isActive || isParentOfActive,
                              'font-semibold': !isActive && !isParentOfActive,
                            })}
                          >
                            {item.label}
                          </span>
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
                        </a>
                      ) : (
                        <div
                          className={classNames(
                            'flex items-center justify-between px-4 py-1.5 transition-colors relative',
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

                      {/* Always show sub-items if they exist */}
                      {item.subItems && (
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
