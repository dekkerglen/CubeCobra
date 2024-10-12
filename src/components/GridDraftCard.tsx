import React, { useContext, useMemo, useState } from 'react';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import Text from './base/Text';
import Select, { rangeOptions } from './base/Select';
import Button from './base/Button';
import { Flexbox } from './base/Layout';

const GridDraftCard: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const [packs, setPacks] = useState('3');
  const [type, setType] = useState('bot');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      packs,
      type,
    }),
    [packs, type],
  );
  return (
    <Card>
      <CSRFForm method="POST" action={`/cube/startgriddraft/${cube.id}`} formData={formData} ref={formRef}>
        <CardHeader>
          <Text semibold lg>
            Grid Draft
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <div className="description-area">
              <p>Grid drafting is a strategic 2 player draft with completely open information.</p>
            </div>
            <Select
              label="Number of packs"
              id="packs"
              defaultValue="3"
              options={rangeOptions(1, 16)}
              value={packs}
              setValue={setPacks}
            />
            <Select
              label="Type"
              id="type"
              defaultValue="bot"
              options={[
                { value: 'bot', label: 'Against Bot' },
                { value: '2playerlocal', label: '2 Player Local' },
              ]}
              value={type}
              setValue={setType}
            />
          </Flexbox>
        </CardBody>
        <CardFooter>
          <Button block color="primary">
            Start Grid Draft
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default GridDraftCard;
