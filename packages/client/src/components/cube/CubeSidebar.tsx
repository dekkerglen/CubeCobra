import React, { useState } from 'react';

import classNames from 'classnames';
import { ChevronLeftIcon, ThreeBarsIcon } from '@primer/octicons-react';

import { getCubeId, getCubeCardCountSnippet } from '@utils/Util';
import Cube from '@utils/datatypes/Cube';

import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

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
  { label: 'Compare', href: '/cube/compare', key: 'compare' },
  { label: 'Analysis', href: '/cube/analysis', key: 'analysis' },
];

const CubeSidebar: React.FC<CubeSidebarProps> = ({ cube, activeLink, controls }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  // Check if activeLink matches any sub-item
  const isSubItemActive = (item: NavigationItem) => {
    if (item.subItems) {
      return item.subItems.some((subItem) => subItem.key === activeLink);
    }
    return false;
  };

  return (
    <div
      className={classNames(
        'bg-bg-accent border-r border-border transition-all duration-300 flex flex-col flex-shrink-0',
        {
          'w-64': isExpanded,
          'w-16 cursor-pointer hover:bg-bg-active': !isExpanded,
        },
      )}
      onClick={!isExpanded ? toggleSidebar : undefined}
    >
      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto">
        {!isExpanded ? (
          <div className="h-full flex items-start justify-center pt-3">
            <ThreeBarsIcon size={20} className="text-text" />
          </div>
        ) : (
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
                        'flex items-center justify-between px-4 py-3 transition-colors relative',
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
                        'flex items-center justify-between px-4 py-3 transition-colors relative',
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

                  {/* Show sub-items when parent is active or when a sub-item is active */}
                  {item.subItems && (isActive || isParentOfActive) && (
                    <div className="bg-bg-active border-b border-border">
                      <Flexbox direction="col" gap="0">
                        {item.subItems.map((subItem) => {
                          const isSubActive = activeLink === subItem.key;
                          const subFullHref = subItem.href
                            ? `${subItem.href}/${encodeURIComponent(getCubeId(cube))}`
                            : undefined;

                          return (
                            <div key={subItem.key}>
                              {subFullHref ? (
                                <a
                                  href={subFullHref}
                                  className={classNames(
                                    'flex items-center px-8 py-2 transition-colors text-sm',
                                    'hover:bg-bg-accent',
                                    {
                                      'font-bold text-text': isSubActive,
                                      'font-normal text-text': !isSubActive,
                                    },
                                  )}
                                >
                                  {subItem.label}
                                </a>
                              ) : (
                                <div
                                  className={classNames(
                                    'flex items-center px-8 py-2 transition-colors text-sm cursor-pointer',
                                    'hover:bg-bg-accent',
                                    {
                                      'font-bold text-text': isSubActive,
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
                    <div className="bg-bg-active border-b border-border">
                      <div className="pl-8 pr-4 py-2 text-sm">{controls}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </Flexbox>
        )}
      </nav>
    </div>
  );
};

export default CubeSidebar;
