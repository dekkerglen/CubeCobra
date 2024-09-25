import React, { ReactNode, useContext } from 'react';
import { NavItem, NavLink } from 'reactstrap';

import CubeSubtitle from 'components/CubeSubtitle';
import ErrorBoundary from 'components/ErrorBoundary';
import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import TagColorContext from 'contexts/TagColorContext';
import Card, { BoardType } from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import { getCubeId } from 'utils/Util';

interface CubeNavItemProps {
  link: string;
  activeLink: string;
  children?: React.ReactNode;
}

const CubeNavItem: React.FC<CubeNavItemProps> = ({ link, activeLink, children }) => {
  const { cube } = useContext(CubeContext)!;
  return (
    <NavItem>
      <NavLink href={`/cube/${link}/${encodeURIComponent(getCubeId(cube!))}`} active={link === activeLink}>
        {children}
      </NavLink>
    </NavItem>
  );
};

interface CubeLayoutInnerProps {
  children: ReactNode;
}

const CubeLayoutInner: React.FC<CubeLayoutInnerProps> = ({ children }) => {
  const { tagColors } = useContext(CubeContext)!;

  return (
    <TagColorContext.Provider value={tagColors}>
      <ErrorBoundary className="mt-3">{children}</ErrorBoundary>
    </TagColorContext.Provider>
  );
};

interface CubeLayoutProps {
  cube: Cube;
  cards: Record<BoardType, Card[]>;
  activeLink: string;
  children?: React.ReactNode;
  loadVersionDict?: boolean;
  useChangedCards?: boolean;
}

const CubeLayout: React.FC<CubeLayoutProps> = ({
  cube,
  cards = { mainboard: [], maybeboard: [] },
  activeLink,
  children,
  loadVersionDict = false,
  useChangedCards = false,
}) => {
  return (
    <CubeContextProvider
      initialCube={cube}
      cards={cards}
      loadVersionDict={loadVersionDict}
      useChangedCards={useChangedCards}
    >
      <div className="mb-3">
        <ul className="cubenav nav nav-tabs nav-fill d-flex flex-column flex-sm-row pt-2">
          <CubeSubtitle />
          <div className="d-flex flex-row flex-wrap">
            <CubeNavItem link="overview" activeLink={activeLink}>
              Overview
            </CubeNavItem>
            <CubeNavItem link="list" activeLink={activeLink}>
              List
            </CubeNavItem>
            <CubeNavItem link="history" activeLink={activeLink}>
              History
            </CubeNavItem>
            <CubeNavItem link="playtest" activeLink={activeLink}>
              Playtest
            </CubeNavItem>
            <CubeNavItem link="analysis" activeLink={activeLink}>
              Analysis
            </CubeNavItem>
            <CubeNavItem link="blog" activeLink={activeLink}>
              Blog
            </CubeNavItem>
          </div>
        </ul>
        <CubeLayoutInner>{children}</CubeLayoutInner>
      </div>
    </CubeContextProvider>
  );
};

export default CubeLayout;
