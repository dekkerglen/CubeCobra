import React, { useCallback, useContext, useState } from 'react';

import Button from 'components/base/Button';
import { Card } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import CardType from '@utils/datatypes/Card';
import { cardName } from '@utils/cardutil';

const MAX_BASICS = 21;

export interface BasicsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addBasics: (counts: number[]) => void;
  deck: number[];
  basics: number[];
  cards: CardType[];
}

const BasicsModal: React.FC<BasicsModalProps> = ({ isOpen, setOpen, addBasics, deck, basics, cards }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [counts, setCounts] = useState<number[]>(basics.map(() => 0));

  const handleAddBasics = useCallback(() => {
    addBasics(counts);
    setCounts(basics.map(() => 0));
    setOpen(false);
  }, [addBasics, setOpen, basics, counts]);

  const calculateBasics = useCallback(async () => {
    const response = await csrfFetch('/cube/api/calculatebasics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainboard: deck.map((index) => cards[index].details),
        basics: basics.map((index) => cards[index].details),
      }),
    });

    const json = await response.json();

    if (json.success === 'true') {
      const newCounts = basics.map(() => 0);

      const toIndex = json.basics.map((card: { oracle_id: string }) =>
        basics.findIndex((index) => cards[index].details?.oracle_id === card.oracle_id),
      );

      for (const index of toIndex) {
        newCounts[index] += 1;
      }

      setCounts(newCounts);
    } else {
      // eslint-disable-next-line no-console
      console.error(json);
    }
  }, [csrfFetch, deck, basics, cards]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>Add Basic Lands</ModalHeader>
      <ModalBody>
        <Row xs={5}>
          {basics.map((cardIndex, index) => (
            <Col xs={1} key={`basics-${index}`}>
              <Card className="mb-3">
                <img className="w-full" src={cards[cardIndex].details?.image_normal} alt={cardName(cards[cardIndex])} />
                <Select
                  options={Array.from(Array(MAX_BASICS + 1).keys()).map((num) => ({
                    value: num.toString(),
                    label: num.toString(),
                  }))}
                  value={`${counts[index]}`}
                  setValue={(value) => {
                    const newCounts = [...counts];
                    newCounts[index] = Number(value);
                    setCounts(newCounts);
                  }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </ModalBody>
      <ModalFooter>
        <Flexbox justify="between" direction="row" gap="2" className="w-full">
          <Button type="submit" color="primary" onClick={handleAddBasics} block>
            Add
          </Button>
          <LoadingButton color="accent" onClick={calculateBasics} block>
            Calculate
          </LoadingButton>
          <Button color="secondary" onClick={() => setOpen(false)} block>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default BasicsModal;
