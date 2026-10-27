import React, { useCallback, useContext, useState } from 'react';

import { cardImageUrl, cardName } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';

import Button from 'components/base/Button';
import { Card } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import { getEmptyBasicsMessage } from 'utils/emptyBasicsMessage';

const MAX_BASICS = 21;

export interface BasicsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addBasics: (counts: number[]) => void;
  deck: number[];
  basics: number[];
  basicsBoard?: string;
  cards: CardType[];
}

const BasicsModal: React.FC<BasicsModalProps> = ({ isOpen, setOpen, addBasics, deck, basics, basicsBoard, cards }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { showCustomImages } = useContext(DisplayContext);
  const { canEdit, cube } = useContext(CubeContext);
  const [counts, setCounts] = useState<number[]>(basics.map(() => 0));
  const empty = basics.length === 0 ? getEmptyBasicsMessage(basicsBoard, canEdit, cube?.id ?? '') : null;

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
      console.error(json);
    }
  }, [csrfFetch, deck, basics, cards]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>Add Basic Lands</ModalHeader>
      <ModalBody>
        {empty ? (
          <Flexbox direction="col" gap="2">
            <Text semibold>{empty.message}</Text>
            {empty.hint && (
              <Text className="text-text-secondary">
                {empty.hint.text} <Link href={empty.hint.href}>{empty.hint.linkText}</Link>.
              </Text>
            )}
          </Flexbox>
        ) : (
          <Row xs={5}>
            {basics.map((cardIndex, index) => (
              <Col xs={1} key={`basics-${index}`}>
                <Card className="mb-3">
                  <img
                    className="w-full"
                    src={(showCustomImages && cardImageUrl(cards[cardIndex])) || cards[cardIndex].details?.image_normal}
                    alt={cardName(cards[cardIndex])}
                  />
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
        )}
      </ModalBody>
      <ModalFooter>
        <Flexbox justify="between" direction="row" gap="2" className="w-full">
          <Button type="submit" color="primary" onClick={handleAddBasics} block disabled={!!empty}>
            Add
          </Button>
          <LoadingButton color="accent" onClick={calculateBasics} block disabled={!!empty}>
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
