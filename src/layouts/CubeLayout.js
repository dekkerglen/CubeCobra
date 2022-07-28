import React, { useContext, useMemo } from 'react';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import ErrorBoundary from 'components/ErrorBoundary';
import { getCubeDescription, getCubeId } from 'utils/Util';

import { NavItem, NavLink } from 'reactstrap';

const CubeNavItem = ({ link, activeLink, children }) => {
  const { cube } = useContext(CubeContext);
  return (
    <NavItem>
      <NavLink href={`/cube/${link}/${encodeURIComponent(getCubeId(cube))}`} active={link === activeLink}>
        {children}
      </NavLink>
    </NavItem>
  );
};

CubeNavItem.propTypes = {
  link: PropTypes.string.isRequired,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
};

CubeNavItem.defaultProps = {
  children: false,
};

const CubeLayout = ({ cube, cards, activeLink, children, loadVersionDict }) => {
  const subtitle = useMemo(() => getCubeDescription(cube), [cube]);
  return (
    <CubeContextProvider initialCube={cube} cards={cards} loadVersionDict={loadVersionDict}>
      <div className="mb-3">
        <ul className="cubenav nav nav-tabs nav-fill d-flex flex-column flex-sm-row pt-2">
          <div className="nav-item px-lg-4 px-3 text-sm-start text-center font-weight-boldish mt-auto mb-2">
            {cube.Name}
            <span className="d-sm-inline"> ({subtitle})</span>
          </div>
          <div className="d-flex flex-row flex-wrap">
            <CubeNavItem link="overview" activeLink={activeLink}>
              Overview
            </CubeNavItem>
            <CubeNavItem link="list" activeLink={activeLink}>
              List
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
        <ErrorBoundary className="mt-3">{children}</ErrorBoundary>
      </div>
    </CubeContextProvider>
  );
};

CubeLayout.propTypes = {
  cube: CubePropType.isRequired,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }),
  loadVersionDict: PropTypes.bool,
};

CubeLayout.defaultProps = {
  children: false,
  cards: {
    boards: [],
  },
  loadVersionDict: false,
};

export default CubeLayout;
