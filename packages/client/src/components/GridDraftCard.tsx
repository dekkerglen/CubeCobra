import React, { useContext, useEffect, useMemo, useState } from 'react';

import { getBoardDefinitions } from '@utils/datatypes/Cube';

import CubeContext from '../contexts/CubeContext';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import { Flexbox } from './base/Layout';
import Select, { rangeOptions } from './base/Select';
import Text from './base/Text';
import CSRFForm from './CSRFForm';

const GridDraftCard: React.FC = () => {
  const { cube, unfilteredChangedCards } = useContext(CubeContext);
  const [packs, setPacks] = useState('18');
  const [type, setType] = useState('bot');
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
      type,
      basicsBoard: basicsBoard === 'none' ? '' : basicsBoard,
    }),
    [packs, type, basicsBoard],
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
              options={rangeOptions(1, 30)}
              value={packs}
              setValue={setPacks}
            />
            <Select
              label="Type"
              id="type"
              options={[
                { value: 'bot', label: 'Against Bot' },
                { value: '2playerlocal', label: '2 Player Local' },
              ]}
              value={type}
              setValue={setType}
            />
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
            Start Grid Draft
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default GridDraftCard;
