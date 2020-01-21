import React, { useContext } from 'react';

import { NavItem, NavLink } from 'reactstrap';

import CubeContext, { CubeContextProvider } from 'components/CubeContext';
import ErrorBoundary from 'components/ErrorBoundary';

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

const CubeLayout = ({ cube, cubeID, canEdit, activeLink, children }) => {
  const categories = cube.categoryPrefixes && cube.categoryPrefixes.length > 0 ? cube.categoryPrefixes.join(' ') + ' ' : '';
  const subtitle = cube.overrideCategory
    ? `${cube.card_count} Card ${categories}${cube.categoryOverride} Cube`
    : `${cube.card_count} Card ${cube.type} Cube`;
  return (
    <CubeContextProvider initialCube={cube.cards} cubeID={cubeID} canEdit={canEdit}>
      <link rel="stylesheet" href="/css/autocomplete.css" />
      <ul className="cubenav nav nav-tabs nav-fill d-flex flex-column flex-sm-row pt-2">
        <div className="nav-item px-lg-4 px-3 text-sm-left text-center font-weight-boldish mt-auto mb-2">
          {cube.name}
          {cube.type && <span className="d-none d-sm-inline"> ({subtitle})</span>}
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
    </CubeContextProvider>
  );
};

export default CubeLayout;
