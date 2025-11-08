import React from 'react';

import Button from 'components/base/Button';
import { Col, Row } from 'components/base/Layout';
import CubesCard from 'components/cube/CubesCard';
import CubeSearchNavBar from 'components/cube/CubeSearchNavBar';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import Cube from '@utils/datatypes/Cube';
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
      <CubeSearchNavBar />
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
            alternateViewFewer={
              <Button color="primary" block type="link" href={`/cube/recents`}>
                View All
              </Button>
            }
          />
        </Col>
      </Row>
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard
            title="Most Popular Cubes"
            className="mt-4"
            cubes={popular}
            alternateViewFewer={
              <Button color="primary" block type="link" href={`/search`}>
                View All
              </Button>
            }
          />
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <CubesCard title="Recently Drafted Cubes" className="mt-4" cubes={drafted} />
        </Col>
      </Row>
    </MainLayout>
  );
};

export default RenderToRoot(ExplorePage);
