import React, { ReactNode, useContext } from 'react';

import { Flexbox } from 'components/base/Layout';
import { Tabs } from 'components/base/Tabs';
import CubeSubtitle from 'components/cube/CubeSubtitle';
import ErrorBoundary from 'components/ErrorBoundary';
import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import TagColorContext from 'contexts/TagColorContext';
import Card, { BoardType } from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import { getCubeId } from 'utils/Util';
import classNames from 'classnames';
import Banner from 'components/Banner';

interface CubeLayoutInnerProps {
  children: ReactNode;
}

const CubeLayoutInner: React.FC<CubeLayoutInnerProps> = ({ children }) => {
  const { tagColors } = useContext(CubeContext)!;

  return (
    <TagColorContext.Provider value={tagColors}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </TagColorContext.Provider>
  );
};

interface CubeLayoutProps {
  cube: Cube;
  cards?: Record<BoardType, Card[]>;
  activeLink: string;
  children?: React.ReactNode;
  loadVersionDict?: boolean;
  useChangedCards?: boolean;
  hasControls?: boolean;
}

const tabs = [
  {
    label: 'Overview',
    href: '/cube/overview',
  },
  {
    label: 'List',
    href: '/cube/list',
  },
  {
    label: 'History',
    href: '/cube/history',
  },
  {
    label: 'Playtest',
    href: '/cube/playtest',
  },
  {
    label: 'Analysis',
    href: '/cube/analysis',
  },
  {
    label: 'Blog',
    href: '/cube/blog',
  },
];

const CubeLayout: React.FC<CubeLayoutProps> = ({
  cube,
  cards = { mainboard: [], maybeboard: [] },
  activeLink,
  children,
  loadVersionDict = false,
  useChangedCards = false,
  hasControls = false,
}) => {
  return (
    <CubeContextProvider
      initialCube={cube}
      cards={cards}
      loadVersionDict={loadVersionDict}
      useChangedCards={useChangedCards}
    >
      <div
        className={classNames('bg-bg-accent border-r border-l border-b border-border', {
          'rounded-b-md': !hasControls,
        })}
      >
        <Banner className="px-2" />
        <Flexbox direction="row" className="px-4" justify="between" wrap="wrap">
          <CubeSubtitle />
          <Tabs
            tabs={tabs.map((tab) => ({
              label: tab.label,
              href: tab.href + '/' + encodeURIComponent(getCubeId(cube)),
            }))}
            activeTab={tabs.findIndex((tab) => tab.href.includes(activeLink))}
          />
        </Flexbox>
      </div>
      <CubeLayoutInner>{children}</CubeLayoutInner>
    </CubeContextProvider>
  );
};

export default CubeLayout;
