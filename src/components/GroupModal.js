import React, { useCallback, useContext, useState } from 'react';

import {
  Button,
  Row,
  Col,
  CustomInput,
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

import { csrfFetch } from 'utils/CSRF';
import { fromEntries } from 'utils/Util';

import AutocardListItem from 'components/AutocardListItem';
import ChangelistContext from 'components/ChangelistContext';
import { ColorChecksAddon } from 'components/ColorCheck';
import CubeContext from 'components/CubeContext';
import GroupModalContext from 'components/GroupModalContext';
import LoadingButton from 'components/LoadingButton';
import MassBuyButton from 'components/MassBuyButton';
import TagInput from 'components/TagInput';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';

const DEFAULT_FORM_VALUES = {
  status: '',
  finish: '',
  cmc: '',
  type_line: '',
  ...fromEntries([...'WUBRGC'].map((c) => [`color${c}`, false])),
  addTags: true,
  deleteTags: false,
  tags: [],
  tagInput: '',
};

const GroupModal = ({ cubeID, canEdit, children, ...props }) => {
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
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const index = target.getAttribute('data-index');

    if (cards.length == 1) {
      close();
    } else {
      setCardIndices((cards) => cards.filter((c) => c !== parseInt(index)));
    }
  });

  const setTagInput = useCallback((value) =>
    setFormValues((formValues) => ({
      ...formValues,
      tagInput: value,
    })),
  );

  const setTags = useCallback((tagF) => {
    setFormValues(({ tags, ...formValues }) => ({ ...formValues, tags: tagF(tags) }));
  });
  const addTag = useCallback((tag) => {
    setTags((tags) => [...tags, tag]);
    setTagInput('');
  });
  const addTagText = useCallback((tag) => tag.trim() && addTag({ text: tag.trim(), id: tag.trim() }));
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
          const updatedCards = cardIndices.map((index) => ({ ...cube.cards[index] }));
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
          remove: cube.cards[index],
        })),
      );
      close();
    },
    [addChanges, cardIndices, cube, close],
  );

  const cards = cardIndices.map((index) => cube.cards[index]);
  const setCards = useCallback((cards) => setCardIndices(cards.map((card) => card.index)));

  const contextChildren = (
    <GroupModalContext.Provider value={{ groupModalCards: cards, openGroupModal: open, setGroupModalCards: setCards }}>
      {children}
    </GroupModalContext.Provider>
  );

  if (!canEdit) {
    return contextChildren;
  }

  const accumulatorUsd = (total, card) => total + (card.details.prices.usd || 0);
  const accumulatorUsdFoil = (total, card) => total + (card.details.prices.usd_foil || 0);
  const accumulatorEur = (total, card) => total + (card.details.prices.eur || 0);
  const accumulatorTix = (total, card) => total + (card.details.prices.tix || 0);
  const totalPriceUsd = cards.length ? cards.reduce(accumulatorUsd, 0) : 0;
  const totalPriceUsdFoil = cards.length ? cards.reduce(accumulatorUsdFoil, 0) : 0;
  const totalPriceEur = cards.length ? cards.reduce(accumulatorEur, 0) : 0;
  const totalPriceTix = cards.length ? cards.reduce(accumulatorTix, 0) : 0;

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
            <Col xs="4" className="d-flex flex-column" style={{ maxHeight: '35rem' }}>
              <Row noGutters className="w-100" style={{ overflow: 'scroll', flexShrink: 1 }}>
                <ListGroup className="list-outline w-100">
                  {cards.map((card) => (
                    <AutocardListItem key={card.index} card={card} noCardModal inModal>
                      <Button close className="mr-1" data-index={card.index} onClick={handleRemoveCard} />
                    </AutocardListItem>
                  ))}
                </ListGroup>
              </Row>
              <Row noGutters>
                {Number.isFinite(totalPriceUsd) && (
                  <TextBadge name="Price USD" className="mt-2 mr-2">
                    <Tooltip text="TCGPlayer Market Price">${Math.round(totalPriceUsd).toLocaleString()}</Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(totalPriceUsdFoil) && (
                  <TextBadge name="Foil USD" className="mt-2 mr-2">
                    <Tooltip text="TCGPlayer Market Foil Price">
                      ${Math.round(totalPriceUsdFoil).toLocaleString()}
                    </Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(totalPriceEur) && (
                  <TextBadge name="EUR" className="mt-2 mr-2">
                    <Tooltip text="Cardmarket Price">${Math.round(totalPriceEur).toLocaleString()}</Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(totalPriceTix) && (
                  <TextBadge name="TIX" className="mt-2 mr-2">
                    <Tooltip text="MTGO TIX">${Math.round(totalPriceTix).toLocaleString()}</Tooltip>
                  </TextBadge>
                )}
              </Row>
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
                  <CustomInput
                    type="select"
                    id="groupStatus"
                    name="status"
                    value={formValues.status}
                    onChange={handleChange}
                  >
                    {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </CustomInput>
                </InputGroup>

                <Label for="groupStatus">
                  <h5>Set Finish of All</h5>
                </Label>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Finish</InputGroupText>
                  </InputGroupAddon>
                  <CustomInput
                    type="select"
                    id="groupFinish"
                    name="finish"
                    value={formValues.finish}
                    onChange={handleChange}
                  >
                    {['', 'Non-foil', 'Foil'].map((finish) => (
                      <option key={finish}>{finish}</option>
                    ))}
                  </CustomInput>
                </InputGroup>

                <h5>Override Attribute on All</h5>
                <InputGroup className="mb-2">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>CMC</InputGroupText>
                  </InputGroupAddon>
                  <Input type="text" name="cmc" value={formValues.cmc} onChange={handleChange} />
                </InputGroup>
                <InputGroup className="mb-2">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Type</InputGroupText>
                  </InputGroupAddon>
                  <Input type="text" name="type_line" value={formValues.type_line} onChange={handleChange} />
                </InputGroup>

                <InputGroup>
                  <InputGroupText className="square-right">Color Identity</InputGroupText>
                  <ColorChecksAddon
                    addonType="append"
                    colorless
                    prefix="color"
                    values={formValues}
                    onChange={handleChange}
                  />
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
                <TagInput
                  tags={formValues.tags}
                  inputValue={formValues.tagInput}
                  handleInputChange={setTagInput}
                  handleInputBlur={addTagText}
                  addTag={addTag}
                  deleteTag={deleteTag}
                  reorderTag={reorderTag}
                />
              </Form>
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
