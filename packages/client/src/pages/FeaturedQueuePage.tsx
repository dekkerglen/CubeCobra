import React from 'react';

import Cube from '@utils/datatypes/Cube';

import Badge from 'components/base/Badge';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface FeaturedQueuePageProps {
  cubes: Cube[];
}

const FeaturedQueuePage: React.FC<FeaturedQueuePageProps> = ({ cubes }) => {
  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-3">
        <DynamicFlash />
        <Card>
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center">
              <Text semibold lg>
                Featured Cubes Queue
              </Text>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text sm>
                These cubes are in the featured rotation. The first two cubes in the queue are featured on the home page
                and cubes in this list are selected randomly for{' '}
                <a href="/tool/p1p1/archive" className="text-link hover:text-link-active">
                  daily P1P1 packs
                </a>
                .
              </Text>
              <Text sm>
                If you'd like to see your cube featured here, consider supporting the site and becoming a{' '}
                <a
                  href="https://www.patreon.com/c/cubecobra/membership"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link hover:text-link-active"
                >
                  Coiling Oracle Patreon member
                </a>
                .
              </Text>
              <Row>
                {cubes.map((cube, index) => (
                  <Col key={cube.id} className="mt-3" xs={6} sm={4} md={3} xl={2}>
                    <CubePreview cube={cube} />
                    {index < 2 && (
                      <div className="text-center mt-2">
                        <Badge color="primary">Currently Featured</Badge>
                      </div>
                    )}
                  </Col>
                ))}
              </Row>
            </Flexbox>
          </CardBody>
        </Card>
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(FeaturedQueuePage);
