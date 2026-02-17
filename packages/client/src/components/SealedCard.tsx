import React, { useContext, useEffect, useMemo, useState } from 'react';

import { getBoardDefinitions } from '@utils/datatypes/Cube';

import CubeContext from '../contexts/CubeContext';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import { Flexbox } from './base/Layout';
import Select, { rangeOptions } from './base/Select';
import Text from './base/Text';
import CSRFForm from './CSRFForm';

const SealedCard: React.FC = () => {
  const { cube, unfilteredChangedCards } = useContext(CubeContext);
  const [packs, setPacks] = useState('6');
  const [cards, setCards] = useState('15');
  const formRef = React.createRef<HTMLFormElement>();

  // Get available boards
  const availableBoards = useMemo(() => {
    // Use unfilteredChangedCards if it has keys, otherwise fall back to cube.cards
    const cards =
      unfilteredChangedCards && Object.keys(unfilteredChangedCards).length > 0
        ? unfilteredChangedCards
        : (cube as any).cards;
    return getBoardDefinitions(cube, cards);
  }, [cube, unfilteredChangedCards]);

  // Set initial basics board to 'basics' if available, otherwise 'none'
  const [basicsBoard, setBasicsBoard] = useState('none');

  useEffect(() => {
    const hasBasics = availableBoards.some((b) => b.name.toLowerCase() === 'basics');
    setBasicsBoard(hasBasics ? 'basics' : 'none');
  }, [availableBoards]);

  const formData = useMemo(
    () => ({
      packs,
      cards,
      basicsBoard: basicsBoard === 'none' ? '' : basicsBoard,
    }),
    [packs, cards, basicsBoard],
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
              options={rangeOptions(1, 16)}
              value={packs}
              setValue={setPacks}
            />
            <Select label="Cards per pack" id="cards" options={rangeOptions(1, 25)} value={cards} setValue={setCards} />
            <Select
              label="Basics board"
              id="basicsBoard"
              options={[
                { value: 'none', label: 'None' },
                ...availableBoards.map((b) => ({ value: b.name.toLowerCase(), label: b.name })),
              ]}
              value={basicsBoard}
              setValue={setBasicsBoard}
            />
          </Flexbox>
        </CardBody>
        <CardFooter>
          <Button block color="primary" onClick={() => formRef.current?.submit()}>
            Start Sealed
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default SealedCard;
