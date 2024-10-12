import React, { useContext, useMemo, useState } from 'react';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import Text from './base/Text';
import Select, { rangeOptions } from './base/Select';
import Button from './base/Button';
import { Flexbox } from './base/Layout';

const SealedCard: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const [packs, setPacks] = useState('3');
  const [cards, setCards] = useState('15');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      packs,
      cards,
    }),
    [packs, cards],
  );

  return (
    <Card>
      <CSRFForm method="POST" action={`/cube/startsealed/${cube.id}`} formData={formData} ref={formRef}>
        <CardHeader>
          <Text lg semibold>
            Standard Sealed
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <Select
              label="Number of packs"
              id="packs"
              defaultValue="3"
              options={rangeOptions(1, 16)}
              value={packs}
              setValue={setPacks}
            />
            <Select
              label="Cards per pack"
              id="cards"
              defaultValue="15"
              options={rangeOptions(1, 25)}
              value={cards}
              setValue={setCards}
            />
          </Flexbox>
        </CardBody>
        <CardFooter>
          <Button block color="primary">
            Start Sealed
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default SealedCard;
