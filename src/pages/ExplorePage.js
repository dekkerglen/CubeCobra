import React from 'react';
import { Col, Container, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import CubesCard from 'components/CubesCard';
import CubeSearchNavBar from 'components/CubeSearchNavBar';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const ExplorePage = ({ recents, featured, drafted, popular, loginCallback }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeSearchNavBar />
      <DynamicFlash />
      <Container>
        <Row>
          <Col lg={6} md={6} sm={12} xs={12}>
            <CubesCard title="Featured Cubes" className="mt-4" cubes={featured} lean />
          </Col>
          <Col lg={6} md={6} sm={12} xs={12}>
            <CubesCard title="Recently Updated Cubes" className="mt-4" cubes={recents} />
          </Col>
        </Row>
        <Row>
          <Col lg={6} md={6} sm={12} xs={12}>
            <CubesCard title="Most Popular Cubes" className="mt-4" cubes={popular} />
          </Col>
          <Col lg={6} md={6} sm={12} xs={12}>
            <CubesCard title="Recently Drafted Cubes" className="mt-4" cubes={drafted} />
          </Col>
        </Row>
      </Container>
    </MainLayout>
  );
};

const cubesListProp = PropTypes.arrayOf(CubePropType);

ExplorePage.propTypes = {
  recents: cubesListProp.isRequired,
  featured: cubesListProp.isRequired,
  drafted: cubesListProp.isRequired,
  popular: cubesListProp.isRequired,
  loginCallback: PropTypes.string,
};

ExplorePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ExplorePage);
