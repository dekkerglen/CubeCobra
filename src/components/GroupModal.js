import React, { useCallback, useContext, useState } from 'react';

import {
  Button,
  Row,
  Col,
  Form,
  FormGroup,
  FormText,
  Input,
  Label,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  ListGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  UncontrolledAlert,
} from 'reactstrap';

import { tcgMassEntryUrl } from '../util/Affiliate';
import { csrfFetch } from '../util/CSRF';
import { fromEntries } from '../util/Util';

import AutocardListItem from './AutocardListItem';
import ChangelistContext from './ChangelistContext';
import { ColorChecksAddon } from './ColorCheck';
import CubeContext from './CubeContext';
import GroupModalContext from './GroupModalContext';
import LoadingButton from './LoadingButton';
import MassBuyButton from './MassBuyButton';
import TagInput from './TagInput';

const DEFAULT_FORM_VALUES = {
  status: '',
  finish: '',
  cmc: '',
  type_line: '',
  ...fromEntries([...'WUBRGC'].map((c) => [`color${c}`, false])),
  addTags: true,
  deleteTags: false,
  tags: [],
};

const GroupModal = ({ cubeID, canEdit, setOpenCollapse, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [cardIndices, setCardIndices] = useState([]);
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);

  const { cube, updateCubeCards } = useContext(CubeContext);
  const { addChanges } = useContext(ChangelistContext);

  const open = useCallback(() => {
    setFormValues(DEFAULT_FORM_VALUES);
    setIsOpen(true);
  });
  const close = useCallback(() => setIsOpen(false));

  const error = useCallback((message) => {
    setAlerts((alerts) => [
      ...alerts,
      {
        color: 'danger',
        message,
      },
    ]);
  });

  const handleChange = useCallback((event) => {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;
    const extra = {};
    if (name === 'addTags') {
      extra.deleteTags = false;
    }
    if (name === 'deleteTags') {
      extra.addTags = false;
    }

    setFormValues((formValues) => ({
      ...formValues,
      [name]: value,
      ...extra,
    }));
  });

  const handleRemoveCard = useCallback((event) => {
    const target = event.currentTarget;
    const index = target.getAttribute('data-index');
    setCardIndices((cards) => cards.filter((c) => c.index !== parseInt(index)));
  });

  const setTags = useCallback((tagF) => {
    setFormValues(({ tags, ...formValues }) => ({ ...formValues, tags: tagF(tags) }));
  });
  const addTag = useCallback((tag) => setTags((tags) => [...tags, tag]));
  const deleteTag = useCallback((tagIndex) => {
    setTags((tags) => tags.filter((tag, i) => i !== tagIndex));
  });
  const reorderTag = useCallback((tag, currIndex, newIndex) => {
    setTags((tags) => arrayMove(tags, currIndex, newIndex));
  });

  const handleApply = useCallback(
    async (event) => {
      event.preventDefault();

      const selected = cardIndices;
      const colors = [...'WUBRG'].filter((color) => formValues[`color${color}`]);
      const updated = {
        ...formValues,
        tags: formValues.tags.map((tag) => tag.text),
      };
      updated.cmc = parseInt(updated.cmc);
      if (isNaN(updated.cmc)) {
        delete updated.cmc;
      }
      updated.colors = colors;
      if (updated.colors.length === 0) {
        delete updated.colors;
      }
      [...'WUBRG'].forEach((color) => delete updated[`color${color}`]);

      try {
        const response = await csrfFetch(`/cube/api/updatecards/${cubeID}`, {
          method: 'POST',
          body: JSON.stringify({ selected, updated }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const json = await response.json();
        if (json.success === 'true') {
          // Make shallow copy of each card.
          const updatedCards = cardIndices.map((index) => ({ ...cube[index] }));
          for (const card of updatedCards) {
            updated.status && (card.status = updated.status);
            updated.finish && (card.finish = updated.finish);
            !isNaN(updated.cmc) && (card.cmc = updated.cmc);
            updated.type_line && (card.type_line = updated.type_line);
            if (updated.addTags) {
              card.tags = [...card.tags, ...updated.tags.filter((tag) => !card.tags.includes(tag))];
            }
            if (updated.deleteTags) {
              card.tags = card.tags.filter((tag) => !updated.tags.includes(tag));
            }

            if (colors.length > 0) {
              card.colors = [...colors];
            }
            if (updated.colorC) {
              card.colors = [];
            }
          }
          updateCubeCards(updatedCards);

          close();
        }
      } catch (e) {
        console.error(e);
        error(e);
      }
    },
    [cardIndices, formValues, updateCubeCards, close, error],
  );

  const handleRemoveAll = useCallback(
    (event) => {
      event.preventDefault();
      addChanges(
        cardIndices.map((index) => ({
          remove: cube[index],
        })),
      );
      setOpenCollapse(() => 'edit');
      close();
    },
    [addChanges, cardIndices, cube, setOpenCollapse, close],
  );

  const cards = cardIndices.map((index) => cube[index]);
  const setCards = useCallback((cards) => setCardIndices(cards.map((card) => card.index)));

  const contextChildren = (
    <GroupModalContext.Provider value={{ groupModalCards: cards, openGroupModal: open, setGroupModalCards: setCards }}>
      {children}
    </GroupModalContext.Provider>
  );

  if (!canEdit) {
    return contextChildren;
  }

  const accumulator = (total, card) => total + (card.details.price || 0);
  const accumulatorFoil = (total, card) => total + (card.details.price_foil || 0);
  const totalPrice = cards.length ? cards.reduce(accumulator, 0) : 0;
  const totalPriceFoil = cards.length ? cards.reduce(accumulatorFoil, 0) : 0;

  return (
    <>
      {contextChildren}
      <Modal size="lg" isOpen={isOpen} toggle={close} {...props}>
        <ModalHeader toggle={close}>Edit Selected</ModalHeader>
        <ModalBody>
          {alerts.map(({ color, message }) => (
            <UncontrolledAlert color={color}>{message}</UncontrolledAlert>
          ))}
          <Row>
            <Col xs="4" style={{ maxHeight: '35rem', overflow: 'scroll' }}>
              <ListGroup className="list-outline">
                {cards.map((card) => (
                  <AutocardListItem key={card.index} card={card} noCardModal inModal>
                    <Button close className="float-none mr-1" data-index={card.index} onClick={handleRemoveCard} />
                  </AutocardListItem>
                ))}
              </ListGroup>
            </Col>
            <Col xs="8">
              <Form>
                <Label for="groupStatus">
                  <h5>Set Status of All</h5>
                </Label>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Status</InputGroupText>
                  </InputGroupAddon>
                  <Input type="select" id="groupStatus" name="status" value={formValues.status} onChange={handleChange}>
                    {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </Input>
                </InputGroup>

                <Label for="groupStatus">
                  <h5>Set Finish of All</h5>
                </Label>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Finish</InputGroupText>
                  </InputGroupAddon>
                  <Input type="select" id="groupFinish" name="finish" value={formValues.finish} onChange={handleChange}>
                    {['', 'Non-foil', 'Foil'].map((finish) => (
                      <option key={finish}>{finish}</option>
                    ))}
                  </Input>
                </InputGroup>

                <h5>Override Attribute on All</h5>
                <InputGroup className="mb-2">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>CMC</InputGroupText>
                  </InputGroupAddon>
                  <Input type="text" name="cmc" value={formValues.cmc} onChange={handleChange} />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Type</InputGroupText>
                  </InputGroupAddon>
                  <Input type="text" name="type_line" value={formValues.type_line} onChange={handleChange} />
                </InputGroup>

                <InputGroup>
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Color Identity</InputGroupText>
                  </InputGroupAddon>
                  <ColorChecksAddon colorless prefix="color" values={formValues} onChange={handleChange} />
                </InputGroup>
                <FormText>
                  Selecting no mana symbols will cause the selected cards' color identity to remain unchanged. Selecting
                  only colorless will cause the selected cards' color identity to be set to colorless.
                </FormText>

                <h5 className="mt-3">Edit Tags</h5>
                <FormGroup tag="fieldset">
                  <FormGroup check>
                    <Label check>
                      <Input type="radio" name="addTags" checked={formValues.addTags} onChange={handleChange} /> Add
                      tags to all
                    </Label>
                  </FormGroup>
                  <FormGroup check>
                    <Label check>
                      <Input type="radio" name="deleteTags" checked={formValues.deleteTags} onChange={handleChange} />{' '}
                      Delete tags from all
                    </Label>
                  </FormGroup>
                </FormGroup>
                <TagInput tags={formValues.tags} {...{ addTag, deleteTag, reorderTag }} />
              </Form>
            </Col>
          </Row>
          <Row>
            <Col xs="4">
              <div className="card-price">Total Price: ${totalPrice.toFixed(2)}</div>
              <div className="card-price">Total Foil Price: ${totalPriceFoil.toFixed(2)}</div>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={handleRemoveAll}>
            Remove all from cube
          </Button>
          <MassBuyButton cards={cards}>Buy all</MassBuyButton>
          <LoadingButton color="success" onClick={handleApply}>
            Apply to all
          </LoadingButton>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default GroupModal;
