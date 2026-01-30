import React, { useContext, useState } from 'react';

import { BookIcon, GraphIcon, ListUnorderedIcon, PlayIcon, TrophyIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { UserRoles } from '@utils/datatypes/User';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import AnalysisViewContext from '../../contexts/AnalysisViewContext';
import DisplayContext from '../../contexts/DisplayContext';
import PlaytestViewContext from '../../contexts/PlaytestViewContext';
import RecordsViewContext from '../../contexts/RecordsViewContext';
import UserContext from '../../contexts/UserContext';

interface NavigationItem {
  label: string;
  href?: string;
  key: string;
  subItems?: NavigationItem[];
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  subItems?: NavigationItem[];
}

interface CubeBottomNavProps {
  cube: Cube;
  activeLink: string;
}

const CubeBottomNav: React.FC<CubeBottomNavProps> = ({ cube, activeLink }) => {
  const user = useContext(UserContext);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { toggleShowMaybeboard, showMaybeboard } = useContext(DisplayContext);
  const analysisViewContext = useContext(AnalysisViewContext);
  const playtestViewContext = useContext(PlaytestViewContext);
  const recordsViewContext = useContext(RecordsViewContext);

  const navItems: NavItem[] = [
    {
      key: 'list',
      label: 'List',
      href: `/cube/list/${encodeURIComponent(getCubeId(cube))}`,
      icon: ListUnorderedIcon,
      subItems: [
        { label: 'Mainboard', key: 'mainboard' },
        { label: 'Maybeboard', key: 'maybeboard' },
      ],
    },
    {
      key: 'about',
      label: 'About',
      href: `/cube/primer/${encodeURIComponent(getCubeId(cube))}`,
      icon: BookIcon,
      subItems: [
        { label: 'Primer', href: '/cube/primer', key: 'primer' },
        { label: 'Blog', href: '/cube/blog', key: 'blog' },
        { label: 'Changelog', href: '/cube/changelog', key: 'changelog' },
      ],
    },
    {
      key: 'playtest',
      label: 'Playtest',
      href: `/cube/playtest/${encodeURIComponent(getCubeId(cube))}`,
      icon: PlayIcon,
      subItems: [
        { label: 'Sample Pack', key: 'sample-pack' },
        { label: 'Practice Draft', key: 'practice-draft' },
        { label: 'Decks', key: 'decks' },
      ],
    },
    {
      key: 'records',
      label: 'Records',
      href: `/cube/records/${encodeURIComponent(getCubeId(cube))}`,
      icon: TrophyIcon,
      subItems: [
        { label: 'Draft Reports', key: 'draft-reports' },
        { label: 'Trophy Archive', key: 'trophy-archive' },
        { label: 'Winrate Analytics', key: 'winrate-analytics' },
      ],
    },
    {
      key: 'analysis',
      label: 'Analysis',
      href: `/cube/analysis/${encodeURIComponent(getCubeId(cube))}`,
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

  // Check if activeLink matches any parent category
  const isActiveCategory = (key: string) => {
    if (key === 'about') {
      return ['primer', 'blog', 'changelog'].includes(activeLink);
    }
    if (key === 'playtest') {
      return ['playtest', 'sample-pack', 'practice-draft', 'decks'].includes(activeLink);
    }
    if (key === 'records') {
      return ['records', 'draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink);
    }
    if (key === 'analysis') {
      return [
        'analysis',
        'averages',
        'table',
        'asfans',
        'chart',
        'recommender',
        'playtest-data',
        'tokens',
        'combos',
      ].includes(activeLink);
    }
    return activeLink === key;
  };

  // Check if user is a patron to determine if ads will be shown
  const shouldShowAds = !(user && Array.isArray(user.roles) && user.roles.includes(UserRoles.PATRON));

  const handleItemClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.subItems) {
      e.preventDefault();
      setOpenMenu(openMenu === item.key ? null : item.key);
    } else {
      setOpenMenu(null);
    }
  };

  const handleSubItemClick = (e: React.MouseEvent, parentKey: string, subItem: NavigationItem) => {
    // Special handling for List sub-items (Mainboard/Maybeboard)
    if (parentKey === 'list') {
      if (activeLink === 'list') {
        e.preventDefault();
        toggleShowMaybeboard();
        setOpenMenu(null);
      }
      // Don't dismiss menu if navigating to a new page
      return;
    }

    // Special handling for Records sub-items
    if (parentKey === 'records' && !subItem.href) {
      if (
        recordsViewContext &&
        (activeLink === 'records' || ['draft-reports', 'trophy-archive', 'winrate-analytics'].includes(activeLink))
      ) {
        e.preventDefault();
        recordsViewContext.setView(subItem.key);
        setOpenMenu(null);
      }
      // Don't dismiss menu if navigating to a new page
      return;
    }

    // Special handling for Playtest sub-items
    if (parentKey === 'playtest' && !subItem.href) {
      if (
        playtestViewContext &&
        (activeLink === 'playtest' || ['sample-pack', 'practice-draft', 'decks'].includes(activeLink))
      ) {
        e.preventDefault();
        playtestViewContext.setView(subItem.key);
        setOpenMenu(null);
      }
      // Don't dismiss menu if navigating to a new page
      return;
    }

    // Special handling for Analysis sub-items
    if (parentKey === 'analysis' && !subItem.href) {
      if (
        analysisViewContext &&
        (activeLink === 'analysis' ||
          ['averages', 'table', 'asfans', 'chart', 'recommender', 'playtest-data', 'tokens', 'combos'].includes(
            activeLink,
          ))
      ) {
        e.preventDefault();
        analysisViewContext.setView(subItem.key);
        setOpenMenu(null);
      }
      // Don't dismiss menu if navigating to a new page
      return;
    }

    // For other navigation (like About sub-items), don't dismiss menu when navigating away
  };

  return (
    <>
      {/* Backdrop */}
      {openMenu && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setOpenMenu(null)}
          aria-hidden="true"
        />
      )}

      {/* Submenu */}
      {openMenu && (
        <div
          className={classNames(
            'lg:hidden',
            'fixed left-0 right-0 z-30',
            'bg-bg-active border-t-2 border-border',
            'shadow-[0_-4px_20px_rgba(0,0,0,0.15)]',
          )}
          style={{
            bottom: shouldShowAds ? 'calc(56px + 50px)' : '56px',
          }}
        >
          <div className="grid grid-cols-2 gap-3 p-4 max-h-64 overflow-y-auto">
            {navItems
              .find((item) => item.key === openMenu)
              ?.subItems?.map((subItem) => {
                let subFullHref = subItem.href ? `${subItem.href}/${encodeURIComponent(getCubeId(cube))}` : undefined;
                let isSubActive = activeLink === subItem.key;

                // Special handling for List sub-items
                if (openMenu === 'list') {
                  const isMainboard = subItem.key === 'mainboard';
                  subFullHref = `/cube/list/${encodeURIComponent(getCubeId(cube))}?board=${subItem.key}`;
                  isSubActive = activeLink === 'list' && (isMainboard ? !showMaybeboard : showMaybeboard);
                }

                // Special handling for Records and Analysis sub-items
                if ((openMenu === 'records' || openMenu === 'analysis' || openMenu === 'playtest') && !subItem.href) {
                  let baseHref = '/cube/records';
                  if (openMenu === 'analysis') {
                    baseHref = '/cube/analysis';
                  } else if (openMenu === 'playtest') {
                    baseHref = '/cube/playtest';
                  }
                  subFullHref = `${baseHref}/${encodeURIComponent(getCubeId(cube))}?view=${subItem.key}`;
                  isSubActive = activeLink === subItem.key;
                }

                return (
                  <a
                    key={subItem.key}
                    href={subFullHref}
                    onClick={(e) => handleSubItemClick(e, openMenu, subItem)}
                    className={classNames(
                      'flex items-center justify-center',
                      'py-3.5 px-4',
                      'rounded-md',
                      'transition-all duration-150',
                      'text-center text-sm font-medium',
                      {
                        'bg-green-500 text-white shadow-md hover:bg-green-600': isSubActive,
                        'bg-bg text-text shadow-sm hover:bg-bg-active hover:shadow-md': !isSubActive,
                      },
                    )}
                  >
                    {subItem.label}
                  </a>
                );
              })}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className={classNames(
          'lg:hidden',
          'fixed bottom-0 left-0 right-0 z-30',
          'bg-bg border-t border-border',
          'flex justify-around items-center',
          'shadow-[0_-2px_10px_rgba(0,0,0,0.1)]',
        )}
        style={{
          paddingBottom: shouldShowAds ? '50px' : '0',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveCategory(item.key);
          const isMenuOpen = openMenu === item.key;

          return (
            <a
              key={item.key}
              href={item.href}
              onClick={(e) => handleItemClick(e, item)}
              className={classNames(
                'flex flex-col items-center justify-center',
                'py-2 px-2 flex-1',
                'transition-all duration-200',
                'relative',
                {
                  'text-green-500': isActive,
                  'text-text-secondary hover:text-text': !isActive,
                  'bg-bg-active': isMenuOpen,
                },
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              aria-expanded={item.subItems ? isMenuOpen : undefined}
            >
              {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500" />}
              <Icon size={22} />
              <span
                className={classNames('text-xs mt-1', {
                  'font-semibold': isActive,
                  'font-normal': !isActive,
                })}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>
    </>
  );
};

export default CubeBottomNav;
