import React, { useContext } from 'react';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import TagColorContext from 'contexts/TagColorContext';
import ErrorBoundary from 'components/ErrorBoundary';
import { getCubeId } from 'utils/Util';
import CubeSubtitle from 'components/CubeSubtitle';

import { NavItem, NavLink } from 'reactstrap';

function CubeNavItem({ link, activeLink, children }) {
  const { cube } = useContext(CubeContext);
  return (
    <NavItem>
      <NavLink href={`/cube/${link}/${encodeURIComponent(getCubeId(cube))}`} active={link === activeLink}>
        {children}
      </NavLink>
    </NavItem>
  );
}

CubeNavItem.propTypes = {
  link: PropTypes.string.isRequired,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
};

CubeNavItem.defaultProps = {
  children: false,
};

function CubeLayoutInner({ children }) {
  const { tagColors } = useContext(CubeContext);

  return (
    <TagColorContext.Provider value={tagColors}>
      <ErrorBoundary className="mt-3">{children}</ErrorBoundary>
    </TagColorContext.Provider>
  );
}

CubeLayoutInner.propTypes = {
  children: PropTypes.node.isRequired,
};

function CubeLayout({ cube, cards, activeLink, children, loadVersionDict, useChangedCards }) {
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
}

CubeLayout.propTypes = {
  cube: CubePropType.isRequired,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }),
  loadVersionDict: PropTypes.bool,
  useChangedCards: PropTypes.bool,
};

CubeLayout.defaultProps = {
  children: false,
  cards: {
    boards: [],
  },
  loadVersionDict: false,
  useChangedCards: false,
};

export default CubeLayout;
