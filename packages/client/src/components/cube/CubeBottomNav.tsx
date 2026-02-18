import React, { useContext } from 'react';

import { BookIcon, GearIcon, GraphIcon, ListUnorderedIcon, PlayIcon, TrophyIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { UserRoles } from '@utils/datatypes/User';
import { getCubeId } from '@utils/Util';
import classNames from 'classnames';

import UserContext from '../../contexts/UserContext';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<any>;
}

interface CubeBottomNavProps {
  cube: Cube;
  activeLink: string;
}

const CubeBottomNav: React.FC<CubeBottomNavProps> = ({ cube, activeLink }) => {
  const user = useContext(UserContext);
  const isCubeOwner = !!user && cube.owner?.id === user.id;

  const navItems: NavItem[] = [
    {
      key: 'list',
      label: 'List',
      href: `/cube/list/${encodeURIComponent(getCubeId(cube))}`,
      icon: ListUnorderedIcon,
    },
    {
      key: 'about',
      label: 'About',
      href: `/cube/about/${encodeURIComponent(getCubeId(cube))}`,
      icon: BookIcon,
    },
    {
      key: 'playtest',
      label: 'Playtest',
      href: `/cube/playtest/${encodeURIComponent(getCubeId(cube))}`,
      icon: PlayIcon,
    },
    {
      key: 'records',
      label: 'Records',
      href: `/cube/records/${encodeURIComponent(getCubeId(cube))}`,
      icon: TrophyIcon,
    },
    {
      key: 'analysis',
      label: 'Analysis',
      href: `/cube/analysis/${encodeURIComponent(getCubeId(cube))}`,
      icon: GraphIcon,
    },
  ];

  // Add Settings for cube owners
  if (isCubeOwner) {
    navItems.push({
      key: 'settings',
      label: 'Settings',
      href: `/cube/settings/${encodeURIComponent(getCubeId(cube))}`,
      icon: GearIcon,
    });
  }

  // Check if activeLink matches any parent category
  const isActiveCategory = (key: string) => {
    if (key === 'about') {
      return ['about', 'primer', 'blog', 'changelog'].includes(activeLink);
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
    if (key === 'settings') {
      return ['settings', 'overview', 'options', 'boards-and-views', 'custom-sorts', 'restore'].includes(activeLink);
    }
    return activeLink === key;
  };

  // Check if user is a patron to determine if ads will be shown
  const shouldShowAds = !(user && Array.isArray(user.roles) && user.roles.includes(UserRoles.PATRON));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className={classNames(
          'sm:hidden',
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

          return (
            <a
              key={item.key}
              href={item.href}
              className={classNames(
                'flex flex-col items-center justify-center',
                'py-2 px-2 flex-1',
                'transition-all duration-200',
                'relative',
                {
                  'text-green-500': isActive,
                  'text-text-secondary hover:text-text': !isActive,
                },
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
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
