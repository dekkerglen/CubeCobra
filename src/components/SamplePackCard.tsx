import React, { useContext, useState } from 'react';

import CubeContext from 'contexts/CubeContext';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import Input from './base/Input';
import { Flexbox } from './base/Layout';
import Text from './base/Text';

const SamplePackCard: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const [seed, setSeed] = useState<string>('');

  return (
    <Card>
      <CardHeader>
        <Text semibold lg>
          View sample pack
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text>
            View a sample pack from this cube. You can view a random pack or a seeded pack using a specific seed. The
            seed can be any string, and will always generate the same pack given the same seed, as long as the cube has
            not changed.
          </Text>
          <Input
            label="Seed"
            type="text"
            name="seed"
            id="seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </Flexbox>
      </CardBody>
      <CardFooter>
        <Flexbox gap="2" direction="row" justify="between">
          <Button block color="primary" type="link" href={`/cube/samplepack/${cube.id}`}>
            View Random
          </Button>
          <Button block color="accent" type="link" disabled={!seed} href={`/cube/samplepack/${cube.id}/${seed}`}>
            View Seeded
          </Button>
        </Flexbox>
      </CardFooter>
    </Card>
  );
};

export default SamplePackCard;
