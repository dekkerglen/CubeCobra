import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import DynamicFlash from 'components/DynamicFlash';
import P1P1FromPackGenerator from 'components/p1p1/P1P1FromPackGenerator';
import RenderToRoot from 'components/RenderToRoot';
import CardType from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface SamplePackPageProps {
  seed: string;
  pack: CardType[];
  cube: Cube;
  isBalanced?: boolean;
  maxBotWeight?: number;
}

const SamplePackPage: React.FC<SamplePackPageProps> = ({ seed, pack, cube, isBalanced = false, maxBotWeight }) => {
  return (
    <MainLayout>
      <CubeLayout cube={cube} activeLink="playtest">
        <Flexbox direction="col" gap="2" className="my-2">
          <DynamicFlash />
          <Card>
            <CardHeader>
              <Flexbox direction="row" justify="between" alignItems="center">
                <Flexbox direction="col" gap="1">
                  <Text semibold lg>
                    {isBalanced ? 'Balanced Sample Pack' : 'Sample Pack'}
                  </Text>
                  {isBalanced && maxBotWeight !== undefined && (
                    <Text sm className="text-gray-600">
                      These packs are generated with a goal of minimizing the highest bot weight in the pack. They
                      should produce interesting picks!
                      <br />
                      Max pick weight: {(maxBotWeight * 100).toFixed(0)}%
                    </Text>
                  )}
                </Flexbox>
                <Flexbox direction="row" gap="2">
                  <P1P1FromPackGenerator cubeId={cube.id} seed={seed} pack={pack} />
                  <Button type="link" color="primary" href={`/cube/samplepack/${cube.id}`}>
                    New Pack
                  </Button>
                  <Button type="link" color="primary" href={`/cube/samplepack/${cube.id}?balanced=true`}>
                    Balanced Pack
                  </Button>
                  <Button
                    type="link"
                    color="accent"
                    href={`/cube/samplepackimage/${cube.id}/${seed}${isBalanced ? '?balanced=true' : ''}`}
                  >
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
