import React from 'react';

import Cube from '@utils/datatypes/Cube';

import { Col, Row } from 'components/base/Layout';
import CubesCard from 'components/cube/CubesCard';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface ExplorePageProps {
  recents: Cube[];
  featured: Cube[];
  drafted: Cube[];
  popular: Cube[];
}

const ExplorePage: React.FC<ExplorePageProps> = ({ recents, featured, drafted, popular }) => {
  return (
    <MainLayout>
      <DynamicFlash />
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard
            title="Featured Cubes"
            className="mt-4"
            cubes={featured}
            lean
            sideLink={{ href: '/queue', text: 'View Queue' }}
          />
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard
            title="Recently Updated Cubes"
            className="mt-4"
            cubes={recents}
            lean
            sideLink={{ href: '/search?order=date&ascending=false', text: 'View More' }}
          />
        </Col>
      </Row>
      <Row className="mb-2">
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard
            title="Most Popular Cubes"
            className="mt-4"
            cubes={popular}
            lean
            sideLink={{ href: '/search', text: 'View More' }}
          />
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard
            title="Recently Drafted Cubes"
            className="mt-4"
            cubes={drafted}
            lean
            sideLink={{ href: '/recentdrafts', text: 'View More' }}
          />
        </Col>
      </Row>
    </MainLayout>
  );
};

export default RenderToRoot(ExplorePage);
