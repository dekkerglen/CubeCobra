import React, { useMemo } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';

import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import PlaytestNavbar from 'components/cube/PlaytestNavbar';
import CustomDraftCard from 'components/CustomDraftCard';
import DynamicFlash from 'components/DynamicFlash';
import GridDraftCard from 'components/GridDraftCard';
import PreviousP1P1sCard from 'components/p1p1/PreviousP1P1sCard';
import PlaytestDecksCard from 'components/PlaytestDecksCard';
import RenderToRoot from 'components/RenderToRoot';
import SamplePackCard from 'components/SamplePackCard';
import SealedCard from 'components/SealedCard';
import StandardDraftCard from 'components/StandardDraftCard';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubePlaytestPageProps {
  cube: Cube;
  decks: Draft[];
  decksLastKey: any;
  previousPacks?: any[];
  previousPacksLastKey?: any;
}

const CubePlaytestPage: React.FC<CubePlaytestPageProps> = ({
  cube,
  decks,
  decksLastKey,
  previousPacks = [],
  previousPacksLastKey,
}) => {
  const defaultFormat = cube.defaultFormat ?? -1;

  // Sort formats alphabetically.
  const formatsSorted = useMemo(
    () =>
      cube.formats
        .map((format, index) => ({ ...format, index }))
        .sort((a, b) => {
          if (a.index === defaultFormat) {
            return -1;
          }
          if (b.index === defaultFormat) {
            return 1;
          }
          return a.title.localeCompare(b.title);
        }),
    [cube.formats, defaultFormat],
  );

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="playtest">
        <Flexbox direction="col" gap="2" className="mb-2">
          <DynamicFlash />
          <PlaytestNavbar />
          <Row>
            <Col xs={12} md={6} xl={6}>
              <Flexbox direction="col" gap="2">
                <SamplePackCard />
                {previousPacks.length > 0 && (
                  <PreviousP1P1sCard
                    packs={previousPacks}
                    packsLastKey={previousPacksLastKey}
                    cubeId={cube.id}
                    cubeOwner={cube.owner.id}
                  />
                )}
                {defaultFormat === -1 && <StandardDraftCard defaultFormat={defaultFormat} />}
                {formatsSorted.map((format) => (
                  <CustomDraftCard
                    key={format.index}
                    format={format}
                    defaultFormat={defaultFormat}
                    formatIndex={format.index}
                  />
                ))}
                {defaultFormat !== -1 && <StandardDraftCard defaultFormat={defaultFormat} />}
                <Card>
                  <CardHeader>
                    <Text semibold lg>
                      Multiplayer Draft
                    </Text>
                  </CardHeader>
                  <CardBody>
                    <Text>
                      Draft with other players and bots online using Draftmancer! Playtest data is uploaded back to
                      CubeCobra.
                    </Text>
                  </CardBody>
                  <CardFooter>
                    <Button
                      block
                      type="link"
                      color="primary"
                      href={`https://draftmancer.com/?cubeCobraID=${cube.id}&cubeCobraName=${encodeURIComponent(cube.name)}`}
                    >
                      Draft on Draftmancer
                    </Button>
                  </CardFooter>
                </Card>
                <SealedCard />
                <GridDraftCard />
              </Flexbox>
            </Col>
            <Col xs={12} md={6} xl={6}>
              <Flexbox direction="col" gap="2">
                <PlaytestDecksCard decks={decks} decksLastKey={decksLastKey} cubeId={cube.id} />
              </Flexbox>
            </Col>
          </Row>
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubePlaytestPage);
