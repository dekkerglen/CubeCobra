import React, { useContext, useMemo, useState } from 'react';

import CubeContext from '../contexts/CubeContext';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import { Flexbox } from './base/Layout';
import Select, { rangeOptions } from './base/Select';
import Text from './base/Text';
import CSRFForm from './CSRFForm';

interface StandardDraftCardProps {
  defaultFormat: number;
}

const StandardDraftCard: React.FC<StandardDraftCardProps> = ({ defaultFormat: defaultFormat }) => {
  const { cube } = useContext(CubeContext);
  const [packs, setPacks] = useState('3');
  const [cards, setCards] = useState('15');
  const [seats, setSeats] = useState('8');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      packs,
      cards,
      seats,
      id: '-1',
    }),
    [packs, cards, seats],
  );

  return (
    <Card>
      <CSRFForm method="POST" action={`/draft/start/${cube.id}`} formData={formData} ref={formRef}>
        <CardHeader>
          <Text lg semibold>
            {defaultFormat === -1 && 'Default Format: '}Standard Draft
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <Select
              label="Number of packs"
              id="packs"
              options={rangeOptions(1, 16)}
              value={packs}
              setValue={setPacks}
            />
            <Select label="Cards per pack" id="cards" options={rangeOptions(1, 25)} value={cards} setValue={setCards} />
            <Select label="Total seats" id="seats" options={rangeOptions(2, 17)} value={seats} setValue={setSeats} />
          </Flexbox>
        </CardBody>
        <CardFooter>
          <Button block color="primary" onClick={() => formRef.current?.submit()}>
            Start Draft
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default StandardDraftCard;
