import React from 'react';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import CardGrid from 'components/CardGrid';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CardType from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import Button from 'components/base/Button';

interface SamplePackPageProps {
  seed: string;
  pack: CardType[];
  cube: Cube;
  loginCallback?: string;
}

const SamplePackPage: React.FC<SamplePackPageProps> = ({ seed, pack, cube, loginCallback = '/' }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        <Flexbox direction="col" gap="2" className="my-2">
          <DynamicFlash />
          <Card>
            <CardHeader>
              <Flexbox direction="row" justify="between" alignItems="center">
                <Text semibold lg>
                  Sample Pack
                </Text>
                <Flexbox direction="row" gap="2">
                  <Button type="link" color="primary" href={`/cube/samplepack/${cube.id}`}>
                    New Pack
                  </Button>
                  <Button type="link" color="accent" href={`/cube/samplepackimage/${cube.id}/${seed}`}>
                    Get image
                  </Button>
                </Flexbox>
              </Flexbox>
            </CardHeader>
            <CardBody>
              <Row className="pack-body justify-content-center g-0">
                <Col>
                  <CardGrid cards={pack} xs={3} md={5} />
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(SamplePackPage);
