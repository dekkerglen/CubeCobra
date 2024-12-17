import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import CardType from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import React from 'react';

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
              <CardGrid cards={pack} xs={3} md={5} lg={8} hrefFn={(card) => `/tool/card/${card.cardID}`} />
            </CardBody>
          </Card>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(SamplePackPage);
