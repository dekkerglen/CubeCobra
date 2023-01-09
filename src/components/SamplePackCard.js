import React, { useContext, useState, useCallback } from 'react';

import CubeContext from 'contexts/CubeContext';
import LabelRow from 'components/LabelRow';

import { Card, CardBody, CardHeader, CardTitle, Input, CardFooter, Button } from 'reactstrap';

const SamplePackCard = (props) => {
  const { cube } = useContext(CubeContext);
  const [seed, setSeed] = useState('');
  const handleChange = useCallback((event) => setSeed(event.target.value), []);

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle tag="h5" className="mb-0">
          View sample pack
        </CardTitle>
      </CardHeader>
      <CardBody>
        <LabelRow htmlFor="seed" label="Seed" className="mb-0">
          <Input type="text" name="seed" id="seed" value={seed} onChange={handleChange} />
        </LabelRow>
      </CardBody>
      <CardFooter>
        <Button color="accent" className="me-2" href={`/cube/samplepack/${cube.id}`}>
          View Random
        </Button>
        <Button color="accent" disabled={!seed} href={`/cube/samplepack/${cube.id}/${seed}`}>
          View Seeded
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SamplePackCard;
