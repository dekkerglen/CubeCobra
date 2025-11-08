import React, { useContext, useEffect, useState } from 'react';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import Cube from '@utils/datatypes/Cube';

interface CustomizeBasicsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
  onError: (message: string) => void;
}

const CustomizeBasicsModal: React.FC<CustomizeBasicsModalProps> = ({ isOpen, setOpen, cube, onError }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [basics, setBasics] = useState<string[]>(cube.basics.slice());
  const [cardName, setCardName] = useState('');
  const [imageDict, setImageDict] = useState<Record<string, { id: string }>>({});
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (isOpen && !fetched) {
      fetch('/cube/api/imagedict')
        .then((response) => response.json())
        .then((json) => {
          setImageDict(json.dict);
          setFetched(true);
        });
    }
  }, [isOpen, fetched]);

  const submitCard = () => {
    if (imageDict) {
      const result = imageDict[cardName.toLowerCase()];
      if (result) {
        setBasics([...basics, result.id]);
        setCardName('');
      }
    }
  };

  const save = async () => {
    const response = await csrfFetch(`/cube/api/updatebasics/${cube.id}`, {
      method: 'POST',
      body: JSON.stringify(basics),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      setOpen(false);
    } else {
      onError('Error updating basics');
    }
  };

  return (
    <Modal xl isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Customize basics
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <p>
            This set of cards will have an unlimited quantity available when constructing decks. You can use this to
            select which art your cube's basics will use, provide multiple art options for your drafters, and also
            provide snow-covered basics. These don't necessarily have to be basic lands, but using an unconventional
            setup here may result in confusing our draft bots' deckbuilding.
          </p>
          <Row>
            <Col xs={12} md={8}>
              <AutocompleteInput
                treeUrl="/cube/api/fullnames"
                treePath="cardnames"
                type="text"
                name="remove"
                value={cardName}
                setValue={setCardName}
                onSubmit={(event) => event.preventDefault()}
                placeholder="Card name and version"
                autoComplete="off"
              />
            </Col>
            <Col xs={12} md={4}>
              <Button
                block
                color="primary"
                onClick={submitCard}
                disabled={!(imageDict && imageDict[cardName.toLowerCase()])}
              >
                Add Card
              </Button>
            </Col>
          </Row>
          <Row xs={2} md={5}>
            {basics.map((cardId, index) => (
              <Col key={cardId} xs={1}>
                <Card className="mb-3">
                  <img className="w-full" src={`/tool/cardimage/${cardId}`} alt={cardId} />
                  <Button
                    block
                    color="danger"
                    onClick={() => {
                      const temp = basics.slice();
                      temp.splice(index, 1);
                      setBasics(temp);
                    }}
                  >
                    Remove
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" className="w-full" justify="between" gap="2">
          <LoadingButton block color="primary" onClick={save}>
            Save Changes
          </LoadingButton>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CustomizeBasicsModal;
