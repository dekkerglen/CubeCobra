import React, { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import { Row, Col, Flexbox } from 'components/base/Layout';
import { Card } from 'components/base/Card';
import Text from 'components/base/Text';
import AutocompleteInput from 'components/base/AutocompleteInput';
import LoadingButton from 'components/LoadingButton';
import { csrfFetch } from 'utils/CSRF';
import Cube from 'datatypes/Cube';
import Button from 'components/base/Button';

interface CustomizeBasicsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
  updateBasics: (basics: string[]) => void;
  onError: (message: string) => void;
}

const CustomizeBasicsModal: React.FC<CustomizeBasicsModalProps> = ({
  isOpen,
  setOpen,
  cube,
  updateBasics,
  onError,
}) => {
  const [basics, setBasics] = useState<string[]>(cube.basics.slice());
  const [cardName, setCardName] = useState('');
  const [imageDict, setImageDict] = useState<Record<string, { id: string }>>({});

  useEffect(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => {
        setImageDict(json.dict);
      });
  }, []);

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
      updateBasics(basics);
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
          <Button block color="danger" onClick={() => setOpen(false)}>
            Close
          </Button>
          <LoadingButton block color="primary" onClick={save}>
            Save Changes
          </LoadingButton>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CustomizeBasicsModal;
