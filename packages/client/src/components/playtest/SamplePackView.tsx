import React from 'react';

import { Col, Flexbox, Row } from 'components/base/Layout';
import CreateP1P1Card from 'components/p1p1/CreateP1P1Card';
import PreviousP1P1sCard from 'components/p1p1/PreviousP1P1sCard';
import SamplePackCard from 'components/SamplePackCard';

interface SamplePackViewProps {
  cubeId: string;
  cubeOwnerId: string;
  previousPacks?: any[];
  previousPacksLastKey?: any;
}

const SamplePackView: React.FC<SamplePackViewProps> = ({
  cubeId,
  cubeOwnerId,
  previousPacks = [],
  previousPacksLastKey,
}) => {
  return (
    <Row className="mb-2">
      <Col xs={12} xl={6}>
        <SamplePackCard />
      </Col>
      <Col xs={12} xl={6}>
        <Flexbox direction="col" gap="2">
          <CreateP1P1Card cubeId={cubeId} />
          {previousPacks.length > 0 && (
            <PreviousP1P1sCard
              packs={previousPacks}
              packsLastKey={previousPacksLastKey}
              cubeId={cubeId}
              cubeOwner={cubeOwnerId}
            />
          )}
        </Flexbox>
      </Col>
    </Row>
  );
};

export default SamplePackView;
