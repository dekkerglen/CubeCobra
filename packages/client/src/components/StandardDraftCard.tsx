import React, { useContext, useEffect, useMemo, useState } from 'react';

import { getBoardDefinitions } from '@utils/datatypes/Cube';

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
  const { cube, canEdit, unfilteredChangedCards } = useContext(CubeContext);
  const [packs, setPacks] = useState('3');
  const [cards, setCards] = useState('15');
  const [seats, setSeats] = useState('8');
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
      seats,
      id: '-1',
      basicsBoard: basicsBoard === 'none' ? '' : basicsBoard,
    }),
    [packs, cards, seats, basicsBoard],
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
          <Flexbox justify="between" direction="row" className="w-full" gap="2">
            <Button block color="primary" onClick={() => formRef.current?.submit()}>
              Start Draft
            </Button>
            {canEdit && defaultFormat !== -1 && (
              <Button
                block
                color="accent"
                className="me-3"
                type="link"
                href={`/cube/${cube.id}/defaultdraftformat/${encodeURIComponent(-1)}`}
              >
                Make Default
              </Button>
            )}
          </Flexbox>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default StandardDraftCard;
