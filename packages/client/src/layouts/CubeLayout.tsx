import React, { ReactNode, useContext } from 'react';

import Card, { BoardType } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import Banner from '../components/Banner';
import CubeBottomNav from '../components/cube/CubeBottomNav';
import CubeHero from '../components/cube/CubeHero';
import CubeSidebar from '../components/cube/CubeSidebar';
import MobileSubNav from '../components/cube/MobileSubNav';
import ErrorBoundary from '../components/ErrorBoundary';
import { ChangesContextProvider } from '../contexts/ChangesContext';
import CubeContext, { CubeContextProvider } from '../contexts/CubeContext';
import { FilterContextProvider } from '../contexts/FilterContext';
import TagColorContext from '../contexts/TagColorContext';

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
  controls?: React.ReactNode;
  rightSidebar?: React.ReactNode;
}

const CubeLayout: React.FC<CubeLayoutProps> = ({
  cube,
  cards = { mainboard: [], maybeboard: [] },
  activeLink,
  children,
  loadVersionDict = false,
  useChangedCards = false,
  controls,
  rightSidebar,
}) => {
  // Only show full hero on list, primer, blog, and changelog pages
  const showFullHero = ['list', 'primer', 'blog', 'changelog'].includes(activeLink);

  return (
    <FilterContextProvider>
      <ChangesContextProvider cube={cube} cards={cards}>
        <CubeContextProvider
          initialCube={cube}
          cards={cards}
          loadVersionDict={loadVersionDict}
          useChangedCards={useChangedCards}
        >
          <div className="flex flex-grow pb-20 sm:pb-0">
            <CubeSidebar cube={cube} activeLink={activeLink} controls={controls} />
            <div className="flex-1 flex flex-col min-w-0">
              <CubeHero cube={cube} minified={!showFullHero} />
              <MobileSubNav cube={cube} activeLink={activeLink} />
              <Banner />
              <div className="px-2">
                <CubeLayoutInner>{children}</CubeLayoutInner>
              </div>
            </div>
            {rightSidebar}
          </div>
          <CubeBottomNav cube={cube} activeLink={activeLink} />
        </CubeContextProvider>
      </ChangesContextProvider>
    </FilterContextProvider>
  );
};

export default CubeLayout;
