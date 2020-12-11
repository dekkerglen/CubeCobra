import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import { NavItem, NavLink } from 'reactstrap';

import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import ErrorBoundary from 'components/ErrorBoundary';
import { getCubeDescription } from 'utils/Util';

const CubeNavItem = ({ link, activeLink, children }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <NavItem>
      <NavLink href={`/cube/${link}/${cubeID}`} active={link === activeLink}>
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

const CubeLayout = ({ cube, cubeID, canEdit, activeLink, children }) => {
  const subtitle = getCubeDescription(cube);
  return (
    <CubeContextProvider initialCube={cube} cubeID={cubeID} canEdit={canEdit}>
      <div className="mb-3">
        <ul className="cubenav nav nav-tabs nav-fill d-flex flex-column flex-sm-row pt-2">
          <div className="nav-item px-lg-4 px-3 text-sm-left text-center font-weight-boldish mt-auto mb-2">
            {cube.name}
            {cube.type && <span className="d-sm-inline"> ({subtitle})</span>}
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
  cubeID: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  activeLink: PropTypes.string.isRequired,
  children: PropTypes.node,
};

CubeLayout.defaultProps = {
  canEdit: false,
  children: false,
};

export default CubeLayout;
