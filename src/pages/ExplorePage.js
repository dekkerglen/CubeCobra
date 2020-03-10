import React from 'react';

import { Col, Row } from 'reactstrap';
import CubesCard from 'components/CubesCard';
import CubeSearchNavBar from 'components/CubeSearchNavBar';

const ExplorePage = ({ recents, featured, drafted, recentlyDrafted }) => {
  return (
    <>
      <CubeSearchNavBar />
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard title="Featured Cubes" cubes={featured} />
          <CubesCard title="Recently Updated Cubes" cubes={recents} />
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard title="Most Drafted Cubes" cubes={drafted} />
          <CubesCard title="Recently Drafted Cubes" cubes={recentlyDrafted} />
        </Col>
      </Row>
    </>
  );
};

export default ExplorePage;
