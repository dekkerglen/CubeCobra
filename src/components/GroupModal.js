import React, { useCallback, useState, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Row,
  Col,
  FormGroup,
  FormText,
  Input,
  Label,
  InputGroup,
  InputGroupText,
  ListGroup,
  Modal,
  ModalBody,
  ModalHeader,
} from 'reactstrap';

import { cardPrice, cardFoilPrice, cardPriceEur, cardTix, cardEtchedPrice } from 'utils/Card';

import AutocardListItem from 'components/AutocardListItem';
import { ColorChecksAddon } from 'components/ColorCheck';
import MassBuyButton from 'components/MassBuyButton';
import TagInput from 'components/TagInput';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import CardPropType from 'proptypes/CardPropType';
import AutocardContext from 'contexts/AutocardContext';

const GroupModal = ({
  isOpen,
  toggle,
  cards,
  canEdit,
  bulkEditCard,
  bulkMoveCard,
  bulkRevertEdit,
  bulkRevertRemove,
  bulkRemoveCard,
  setModalSelection,
  tagColors,
}) => {
  const [status, setStatus] = useState('');
  const [finish, setFinish] = useState('');
  const [cmc, setCmc] = useState('');
  const [typeLine, setTypeLine] = useState('');
  const [color, setColor] = useState([]);
  const [addTags, setAddTags] = useState(true);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const { hideCard } = useContext(AutocardContext);

  const filterOut = useCallback(
    (card) => {
      setModalSelection(cards.filter((c) => !(c.index === card.index && c.board === card.board)));
      hideCard();
    },
    [cards, hideCard, setModalSelection],
  );

  const removeAll = useCallback(() => {
    bulkRemoveCard(
      cards.map((card) => ({
        board: card.board,
        index: card.index,
      })),
    );
    toggle();
  }, [bulkRemoveCard, cards, toggle]);

  const revertRemoval = useCallback(() => {
    bulkRevertRemove(
      cards
        .filter((card) => card.markedForDelete)
        .map((card) => ({
          board: card.board,
          index: card.index,
        })),
    );
  }, [bulkRevertRemove, cards]);

  const bulkRevertEditAll = useCallback(() => {
    bulkRevertEdit(
      cards.map((card) => ({
        board: card.board,
        index: card.index,
      })),
    );
  }, [bulkRevertEdit, cards]);

  const applyChanges = useCallback(() => {
    const updates = JSON.parse(JSON.stringify(cards));

    if (status !== '') {
      updates.forEach((card) => {
        card.status = status;
      });
    }

    if (finish !== '') {
      updates.forEach((card) => {
        card.finish = finish;
      });
    }

    if (cmc !== '') {
      updates.forEach((card) => {
        card.cmc = cmc;
      });
    }

    if (typeLine !== '') {
      updates.forEach((card) => {
        card.type_line = typeLine;
      });
    }

    if (color.length > 0) {
      updates.forEach((card) => {
        if (color.includes('C')) {
          card.colors = [];
        } else {
          card.colors = color;
        }
      });
    }

    if (tags.length > 0) {
      if (addTags) {
        updates.forEach((card) => {
          card.tags = [...new Set([...card.tags, ...tags.map((tag) => tag.text)])];
        });
      } else {
        updates.forEach((card) => {
          card.tags = card.tags.filter((tag) => !tags.map((t) => t.text).includes(tag));
        });
      }
    }

    bulkEditCard(updates);
    setModalSelection([]);
    toggle();
  }, [addTags, bulkEditCard, cards, cmc, color, finish, setModalSelection, status, tags, toggle, typeLine]);

  const anyCardChanged = useMemo(() => {
    return cards.some((card) => card.editIndex !== undefined);
  }, [cards]);

  const anyCardRemoved = useMemo(() => {
    return cards.some((card) => card.markedForDelete);
  }, [cards]);

  const fieldsChanged = useMemo(() => {
    return status !== '' || finish !== '' || cmc !== '' || typeLine !== '' || color.length > 0 || tags.length > 0;
  }, [status, finish, cmc, typeLine, color, tags]);

  const totalPriceUsd = cards.length ? cards.reduce((total, card) => total + (cardPrice(card) ?? 0), 0) : 0;
  const totalPriceUsdFoil = cards.length ? cards.reduce((total, card) => total + (cardFoilPrice(card) ?? 0), 0) : 0;
  const totalPriceUsdEtched = cards.length ? cards.reduce((total, card) => total + (cardEtchedPrice(card) ?? 0), 0) : 0;
  const totalPriceEur = cards.length ? cards.reduce((total, card) => total + (cardPriceEur(card) ?? 0), 0) : 0;
  const totalPriceTix = cards.length ? cards.reduce((total, card) => total + (cardTix(card) ?? 0), 0) : 0;

  return (
    <Modal size="xl" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Edit Selected ({cards.length} cards)</ModalHeader>
      <ModalBody>
        <Row>
          <Col xs="4" className="d-flex flex-column" style={{ maxHeight: '35rem' }}>
            <Row className="w-100 g-0" style={{ overflowY: 'auto', flexShrink: 1 }}>
              <ListGroup className="list-outline w-100">
                {cards.map((card) => (
                  <AutocardListItem key={card.index} card={card} noCardModal inModal>
                    <Button close className="me-1" data-index={card.index} onClick={() => filterOut(card)} />
                  </AutocardListItem>
                ))}
              </ListGroup>
            </Row>
            <Row className="g-0">
              {Number.isFinite(totalPriceUsd) && (
                <TextBadge name="Price USD" className="mt-2 me-2">
                  <Tooltip text="TCGPlayer Market Price">${Math.round(totalPriceUsd).toLocaleString()}</Tooltip>
                </TextBadge>
              )}
              {Number.isFinite(totalPriceUsdFoil) && (
                <TextBadge name="Foil USD" className="mt-2 me-2">
                  <Tooltip text="TCGPlayer Market Foil Price">
                    ${Math.round(totalPriceUsdFoil).toLocaleString()}
                  </Tooltip>
                </TextBadge>
              )}
              {Number.isFinite(totalPriceUsdEtched) && (
                <TextBadge name="Etched USD" className="mt-2 me-2">
                  <Tooltip text="TCGPlayer Market Foil Price">
                    ${Math.round(totalPriceUsdFoil).toLocaleString()}
                  </Tooltip>
                </TextBadge>
              )}
              {Number.isFinite(totalPriceEur) && (
                <TextBadge name="EUR" className="mt-2 me-2">
                  <Tooltip text="Cardmarket Price">${Math.round(totalPriceEur).toLocaleString()}</Tooltip>
                </TextBadge>
              )}
              {Number.isFinite(totalPriceTix) && (
                <TextBadge name="TIX" className="mt-2 me-2">
                  <Tooltip text="MTGO TIX">${Math.round(totalPriceTix).toLocaleString()}</Tooltip>
                </TextBadge>
              )}
            </Row>
            <Row>
              <Col xs="12">
                <Button className="my-1" block outline color="unsafe" onClick={removeAll}>
                  Remove all from cube
                </Button>
              </Col>
              <Col xs="12">
                <Button
                  className="my-1"
                  color="warning"
                  block
                  outline
                  onClick={() => {
                    bulkMoveCard(cards, 'maybeboard');
                    toggle();
                  }}
                >
                  <span className="d-none d-sm-inline">Move all to Maybeboard</span>
                  <span className="d-sm-none">Maybeboard</span>
                </Button>
              </Col>
              <Col xs="12">
                <Button
                  className="my-1"
                  color="warning"
                  block
                  outline
                  onClick={() => {
                    bulkMoveCard(cards, 'mainboard');
                    toggle();
                  }}
                >
                  <span className="d-none d-sm-inline">Move all to Mainboard</span>
                  <span className="d-sm-none">Mainboard</span>
                </Button>
              </Col>
            </Row>
            {anyCardRemoved && (
              <Row>
                <Col xs="12">
                  <Button className="my-1" block outline color="success" onClick={revertRemoval}>
                    Revert removal of removed cards
                  </Button>
                </Col>
              </Row>
            )}
            {anyCardChanged && (
              <Row>
                <Col xs="12">
                  <Button className="my-1" block outline color="success" onClick={bulkRevertEditAll}>
                    Revert changes of edited cards
                  </Button>
                </Col>
              </Row>
            )}
            <Row>
              <Col xs="12">
                <MassBuyButton className="my-1" block outline cards={cards}>
                  Buy all
                </MassBuyButton>
              </Col>
            </Row>
          </Col>
          <Col xs="8">
            <fieldset disabled={!canEdit}>
              <Label for="groupStatus">
                <h5>Set status of All</h5>
              </Label>
              <InputGroup className="mb-3">
                <InputGroupText>Status</InputGroupText>
                <Input
                  type="select"
                  id="groupStatus"
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Input>
              </InputGroup>

              <Label for="groupStatus">
                <h5>Set Finish of All</h5>
              </Label>
              <InputGroup className="mb-3">
                <InputGroupText>Finish</InputGroupText>
                <Input
                  type="select"
                  id="groupFinish"
                  name="finish"
                  value={finish}
                  onChange={(e) => setFinish(e.target.value)}
                >
                  {['', 'Non-foil', 'Foil'].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </Input>
              </InputGroup>

              <h5>Override Attribute on All</h5>
              <InputGroup className="mb-2">
                <InputGroupText>Mana Value</InputGroupText>
                <Input type="text" name="cmc" value={cmc} onChange={(e) => setCmc(e.target.value)} />
              </InputGroup>
              <InputGroup className="mb-2">
                <InputGroupText>Type</InputGroupText>
                <Input type="text" name="type_line" value={typeLine} onChange={(e) => setTypeLine(e.target.value)} />
              </InputGroup>

              <InputGroup>
                <InputGroupText className="square-right">Color Identity</InputGroupText>
                <ColorChecksAddon addonType="append" colorless prefix="color" values={color} setValues={setColor} />
              </InputGroup>
              <FormText>
                Selecting no mana symbols will cause the selected cards' color identity to remain unchanged. Selecting
                only colorless will cause the selected cards' color identity to be set to colorless.
              </FormText>

              <h5 className="mt-3">Edit tags</h5>
              <FormGroup tag="fieldset">
                <FormGroup check>
                  <Label check>
                    <Input
                      type="radio"
                      name="addTags"
                      checked={addTags}
                      onChange={(e) => setAddTags(e.target.checked)}
                    />{' '}
                    Add tags to all
                  </Label>
                </FormGroup>
                <FormGroup check>
                  <Label check>
                    <Input
                      type="radio"
                      name="deleteTags"
                      checked={!addTags}
                      onChange={(e) => setAddTags(!e.target.checked)}
                    />{' '}
                    Delete tags from all
                  </Label>
                </FormGroup>
              </FormGroup>
              <TagInput
                tags={tags}
                inputValue={tagInput}
                handleInputChange={setTagInput}
                handleInputBlur={setTagInput}
                addTag={(tag) => setTags([...tags, tag])}
                deleteTag={(index) => {
                  const newTags = [...tags];
                  newTags.splice(index, 1);
                  setTags(newTags);
                }}
                reorderTag={(index, newIndex) => {
                  const newTags = [...tags];
                  const tag = newTags.splice(index, 1)[0];
                  newTags.splice(newIndex, 0, tag);
                  setTags(newTags);
                }}
                tagColors={tagColors}
              />
            </fieldset>
            <Row>
              <Col xs="12">
                <Button className="my-1" block outline color="accent" disabled={!fieldsChanged} onClick={applyChanges}>
                  Apply to all
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </ModalBody>
    </Modal>
  );
};

GroupModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cards: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
  canEdit: PropTypes.bool,
  versionDict: PropTypes.shape({}),
  setModalSelection: PropTypes.func.isRequired,
  tagColors: PropTypes.arrayOf(PropTypes.string),
  bulkEditCard: PropTypes.func.isRequired,
  bulkRemoveCard: PropTypes.func.isRequired,
  bulkRevertEdit: PropTypes.func.isRequired,
  bulkRevertRemove: PropTypes.func.isRequired,
};

GroupModal.defaultProps = {
  canEdit: false,
  versionDict: {},
  tagColors: [],
};

export default GroupModal;
