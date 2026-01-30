import React, { useMemo } from 'react';

import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CustomDraftCard from 'components/CustomDraftCard';
import GridDraftCard from 'components/GridDraftCard';
import SealedCard from 'components/SealedCard';
import StandardDraftCard from 'components/StandardDraftCard';

interface PracticeDraftViewProps {
  cube: Cube;
}

const PracticeDraftView: React.FC<PracticeDraftViewProps> = ({ cube }) => {
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
    <Row>
      <Col xs={12} md={6} xl={6}>
        <Flexbox direction="col" gap="2">
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
        </Flexbox>
      </Col>
      <Col xs={12} md={6} xl={6}>
        <Flexbox direction="col" gap="2">
          <Card>
            <CardHeader>
              <Text semibold lg>
                Multiplayer Draft
              </Text>
            </CardHeader>
            <CardBody>
              <Text>
                Draft with other players and bots online using Draftmancer! Playtest data is uploaded back to CubeCobra.
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
    </Row>
  );
};

export default PracticeDraftView;
