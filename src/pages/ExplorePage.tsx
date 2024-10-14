import React from 'react';
import { Col, Row } from 'components/base/Layout';
import Cube from 'datatypes/Cube';

import CubesCard from 'components/CubesCard';
import CubeSearchNavBar from 'components/CubeSearchNavBar';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface ExplorePageProps {
  recents: Cube[];
  featured: Cube[];
  drafted: Cube[];
  popular: Cube[];
  loginCallback?: string;
}

const ExplorePage: React.FC<ExplorePageProps> = ({ recents, featured, drafted, popular, loginCallback = '/' }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeSearchNavBar />
      <DynamicFlash />
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
    </MainLayout>
  );
};

export default RenderToRoot(ExplorePage);
