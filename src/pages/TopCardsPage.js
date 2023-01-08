import React from 'react';
import PropTypes from 'prop-types';

import DynamicFlash from 'components/DynamicFlash';
import FilterCollapse from 'components/FilterCollapse';
import TopCardsTable from 'components/TopCardsTable';
import { Row, Col } from 'reactstrap';
import ButtonLink from 'components/ButtonLink';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

import { CubeContextProvider } from 'contexts/CubeContext';

const TopCardsPage = ({ loginCallback }) => {
  return (
    <CubeContextProvider initialCube={{ defaultSorts: [] }} cards={{ Mainboard: [] }}>
      <MainLayout loginCallback={loginCallback}>
        <div className="usercontrols pt-3 mb-3">
          <Row className="pb-3 me-1">
            <Col xs="6">
              <h3 className="mx-3">Top cards</h3>
            </Col>
            <Col xs="6">
              <div className="text-end">
                <ButtonLink outline color="accent" href="/tool/searchcards">
                  Search All cards
                </ButtonLink>{' '}
                <ButtonLink outline color="accent" href="/packages/browse">
                  View Card Packages
                </ButtonLink>
              </div>
            </Col>
          </Row>
          <FilterCollapse isOpen />
        </div>
        <DynamicFlash />
        <TopCardsTable />
      </MainLayout>
    </CubeContextProvider>
  );
};

TopCardsPage.propTypes = {
  loginCallback: PropTypes.string,
};

TopCardsPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(TopCardsPage);
