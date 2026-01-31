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

  // Create array of all tiles to render
  const allTiles = useMemo(() => {
    const tiles = [];

    // Add standard draft card at the beginning if it's default, otherwise at the end
    if (defaultFormat === -1) {
      tiles.push({ type: 'standard', key: 'standard' });
    }

    // Add all custom draft cards
    formatsSorted.forEach((format) => {
      tiles.push({ type: 'custom', key: `custom-${format.index}`, format, formatIndex: format.index });
    });

    // Add standard draft card at the end if it's not default
    if (defaultFormat !== -1) {
      tiles.push({ type: 'standard', key: 'standard' });
    }

    // Add fixed cards
    tiles.push({ type: 'multiplayer', key: 'multiplayer' });
    tiles.push({ type: 'sealed', key: 'sealed' });
    tiles.push({ type: 'grid', key: 'grid' });

    return tiles;
  }, [defaultFormat, formatsSorted]);

  // Split tiles into two columns using evens and odds for balanced distribution
  const leftColumnTiles = useMemo(() => allTiles.filter((_, index) => index % 2 === 0), [allTiles]);
  const rightColumnTiles = useMemo(() => allTiles.filter((_, index) => index % 2 === 1), [allTiles]);

  const renderTile = (tile: any) => {
    switch (tile.type) {
      case 'standard':
        return <StandardDraftCard key={tile.key} defaultFormat={defaultFormat} />;
      case 'custom':
        return (
          <CustomDraftCard
            key={tile.key}
            format={tile.format}
            defaultFormat={defaultFormat}
            formatIndex={tile.formatIndex}
          />
        );
      case 'multiplayer':
        return (
          <Card key={tile.key}>
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
        );
      case 'sealed':
        return <SealedCard key={tile.key} />;
      case 'grid':
        return <GridDraftCard key={tile.key} />;
      default:
        return null;
    }
  };

  return (
    <Row>
      <Col xs={12} md={6} xl={6}>
        <Flexbox direction="col" gap="2">
          {leftColumnTiles.map(renderTile)}
        </Flexbox>
      </Col>
      <Col xs={12} md={6} xl={6}>
        <Flexbox direction="col" gap="2">
          {rightColumnTiles.map(renderTile)}
        </Flexbox>
      </Col>
    </Row>
  );
};

export default PracticeDraftView;
