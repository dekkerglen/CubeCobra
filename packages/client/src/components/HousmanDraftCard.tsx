import React, { useContext, useMemo, useState } from 'react';

import CubeContext from '../contexts/CubeContext';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import { Flexbox } from './base/Layout';
import Select, { rangeOptions } from './base/Select';
import Text from './base/Text';
import CSRFForm from './CSRFForm';

const HousmanDraftCard: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const [players, setPlayers] = useState('2');
  const [rounds, setRounds] = useState('9');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      players,
      rounds,
    }),
    [players, rounds],
  );
  return (
    <Card>
      <CSRFForm method="POST" action={`/cube/starthousmandraft/${cube.id}`} formData={formData} ref={formRef}>
        <CardHeader>
          <Text semibold lg>
            Housman Draft
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <div className="description-area">
              <p>
                A draft format that keeps some information hidden, leading to powerful, focused decks. Each round you
                swap cards between your hidden hand and a shared face-up pool. Play against bots and add each kept hand
                to your pool.
              </p>
            </div>
            <Select
              label="Number of players"
              id="players"
              options={rangeOptions(2, 6)}
              value={players}
              setValue={setPlayers}
            />
            <Select
              label="Number of rounds"
              id="rounds"
              options={rangeOptions(1, 16)}
              value={rounds}
              setValue={setRounds}
            />
          </Flexbox>
        </CardBody>
        <CardFooter>
          <Button block color="primary" onClick={() => formRef.current?.submit()}>
            Start Housman Draft
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default HousmanDraftCard;
