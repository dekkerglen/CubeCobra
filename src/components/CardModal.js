import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Col,
  Input,
  InputGroup,
  InputGroupText,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
  Badge,
  Spinner,
} from 'reactstrap';

import { getTCGLink } from 'utils/Affiliate';
import { getLabels, cardGetLabels } from 'utils/Sort';
import {
  cardPrice,
  cardFoilPrice,
  cardEtchedPrice,
  cardPriceEur,
  cardTix,
  cardElo,
  normalizeName,
  cardFinish,
  cardCmc,
  cardType,
  cardRarity,
  cardColorIdentity,
  cardColorCategory,
  cardTags,
  cardStatus,
} from 'utils/Card';

import { ColorChecksAddon } from 'components/ColorCheck';
import FoilCardImage from 'components/FoilCardImage';
import TagInput from 'components/TagInput';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import CardPropType from 'proptypes/CardPropType';

const CardModal = ({
  isOpen,
  toggle,
  card,
  canEdit,
  versionDict,
  editCard,
  revertEdit,
  revertRemove,
  removeCard,
  tagColors,
  moveCard,
}) => {
  const [versions, setVersions] = useState(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!versionDict[normalizeName(card.details.name)]) {
      setVersions({});
    } else {
      setVersions(Object.fromEntries(versionDict[normalizeName(card.details.name)].map((v) => [v._id, v])));
    }
  }, [card, versionDict]);

  const updateField = useCallback(
    (field, value) => {
      editCard(card.index, { ...card, [field]: value }, card.board);
    },
    [card, editCard],
  );

  const disabled = !canEdit || card.markedForDelete;

  return (
    <Modal size="xl" isOpen={isOpen} labelledby="cardModalHeader" toggle={toggle}>
      <ModalHeader id="cardModalHeader" toggle={toggle}>
        {card.details.name} {card.markedForDelete && <Badge color="danger">Marked for Removal</Badge>}
        {card.editIndex !== undefined && <Badge color="warning">*Pending Edit*</Badge>}
      </ModalHeader>
      <ModalBody>
        {versions ? (
          <Row>
            <Col xs="12" sm="4">
              <FoilCardImage card={card} finish={card.finish} />
              <Row className="mb-2 g-0">
                {card.details.prices && Number.isFinite(cardPrice(card)) && (
                  <TextBadge name="Price" className="mt-2 me-2">
                    <Tooltip text="TCGPlayer Market Price">${cardPrice(card).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details.prices && Number.isFinite(cardFoilPrice(card)) && (
                  <TextBadge name="Foil" className="mt-2 me-2">
                    <Tooltip text="TCGPlayer Market Price">${cardFoilPrice(card).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details.prices && Number.isFinite(cardEtchedPrice(card)) && (
                  <TextBadge name="Etched" className="mt-2 me-2">
                    <Tooltip text="TCGPlayer Market Price">${cardEtchedPrice(card).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details.prices && Number.isFinite(cardPriceEur(card)) && (
                  <TextBadge name="EUR" className="mt-2 me-2">
                    <Tooltip text="Cardmarket Price">€{cardPriceEur(card).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details.prices && Number.isFinite(cardTix(card)) && (
                  <TextBadge name="TIX" className="mt-2 me-2">
                    <Tooltip text="MTGO TIX">{cardTix(card).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(cardElo(card)) && (
                  <TextBadge name="Elo" className="mt-2">
                    {cardElo(card).toFixed(0)}
                  </TextBadge>
                )}
              </Row>
              <Row>
                {canEdit && (
                  <>
                    {card.markedForDelete ? (
                      <Col xs="12">
                        <Button
                          className="my-1"
                          color="success"
                          block
                          outline
                          onClick={() => revertRemove(card.removeIndex, card.board)}
                        >
                          Revert Removal
                        </Button>
                      </Col>
                    ) : (
                      <>
                        <Col xs="12">
                          <Button
                            className="my-1"
                            color="danger"
                            block
                            outline
                            onClick={() => {
                              removeCard(card.index, card.board);
                              toggle();
                            }}
                          >
                            <span className="d-none d-sm-inline">Remove from cube</span>
                            <span className="d-sm-none">Remove</span>
                          </Button>
                        </Col>
                        {card.board === 'mainboard' ? (
                          <Col xs="12">
                            <Button
                              className="my-1"
                              color="warning"
                              block
                              outline
                              onClick={() => {
                                moveCard(card.index, card.board, 'maybeboard');
                                toggle();
                              }}
                            >
                              <span className="d-none d-sm-inline">Move to Maybeboard</span>
                              <span className="d-sm-none">Maybeboard</span>
                            </Button>
                          </Col>
                        ) : (
                          <Col xs="12">
                            <Button
                              className="my-1"
                              color="warning"
                              block
                              outline
                              onClick={() => {
                                moveCard(card.index, card.board, 'mainboard');
                                toggle();
                              }}
                            >
                              <span className="d-none d-sm-inline">Move to Mainboard</span>
                              <span className="d-sm-none">Mainboard</span>
                            </Button>
                          </Col>
                        )}
                      </>
                    )}
                    {card.editIndex !== undefined && (
                      <Col xs="12">
                        <Button
                          className="my-1"
                          color="success"
                          block
                          outline
                          onClick={() => revertEdit(card.editIndex, card.board)}
                        >
                          Revert Edit
                        </Button>
                      </Col>
                    )}
                  </>
                )}
                <Col xs="12">
                  <Button
                    className="my-1"
                    block
                    outline
                    color="primary"
                    href={card.details.scryfall_uri}
                    target="_blank"
                  >
                    <span className="d-none d-sm-inline">View on Scryfall</span>
                    <span className="d-sm-none">Scryfall</span>
                  </Button>
                </Col>
                <Col xs="12">
                  <Button
                    className="my-1"
                    block
                    outline
                    color="primary"
                    href={`/tool/card/${card.cardID}`}
                    target="_blank"
                  >
                    <span className="d-none d-sm-inline">View Card Analytics</span>
                    <span className="d-sm-none">Analytics</span>
                  </Button>
                </Col>
                <Col xs="12">
                  <Button className="my-1" block outline color="primary" href={getTCGLink(card)} target="_blank">
                    Buy
                  </Button>
                </Col>
              </Row>
            </Col>
            <Col xs="12" sm="8">
              <h5>Card Attributes</h5>
              <fieldset disabled={disabled}>
                <InputGroup className="mb-3">
                  <InputGroupText>Version (Set and #)</InputGroupText>
                  <Input
                    type="select"
                    name="version"
                    id="cardModalVersion"
                    value={card.cardID}
                    onChange={(e) => updateField('cardID', e.target.value)}
                  >
                    {Object.entries(versions).map(([key, value]) => {
                      return (
                        <option key={key} value={key}>
                          {value.version}
                        </option>
                      );
                    })}
                  </Input>
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Status</InputGroupText>
                  <Input
                    type="select"
                    name="status"
                    id="cardModalStatus"
                    value={cardStatus(card)}
                    onChange={(event) => updateField('status', event.target.value)}
                  >
                    {getLabels(null, 'Status').map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Input>
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Finish</InputGroupText>
                  <Input
                    type="select"
                    name="finish"
                    id="cardModalFinish"
                    value={cardFinish(card)}
                    onChange={(event) => updateField('finish', event.target.value)}
                  >
                    {getLabels(null, 'Finish').map((finish) => (
                      <option key={finish}>{finish}</option>
                    ))}
                  </Input>
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Mana Value</InputGroupText>
                  <Input
                    type="text"
                    name="cmc"
                    value={cardCmc(card)}
                    onChange={(event) => updateField('cmc', event.target.value)}
                  />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Type</InputGroupText>
                  <Input
                    type="text"
                    name="type_line"
                    value={cardType(card)}
                    onChange={(event) => updateField('type_line', event.target.value)}
                  />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Rarity</InputGroupText>
                  <Input
                    type="select"
                    name="rarity"
                    id="cardModalRarity"
                    value={cardRarity(card)}
                    onChange={(event) => updateField('rarity', event.target.value)}
                  >
                    {getLabels(null, 'Rarity').map((rarity) => (
                      <option key={rarity} value={rarity.toLowerCase()}>
                        {rarity}
                      </option>
                    ))}
                  </Input>
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Image URL</InputGroupText>
                  <Input
                    type="text"
                    name="imgUrl"
                    value={card.imgUrl || ''}
                    onChange={(event) => updateField('imgUrl', event.target.value)}
                  />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Image Back URL</InputGroupText>
                  <Input
                    type="text"
                    name="imgBackUrl"
                    value={card.imgBackUrl || ''}
                    onChange={(event) => updateField('imgBackUrl', event.target.value)}
                  />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText className="square-right">Color</InputGroupText>
                  <ColorChecksAddon
                    prefix="color"
                    values={cardColorIdentity(card)}
                    setValues={(colors) => updateField('colors', colors)}
                  />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupText>Color Category</InputGroupText>
                  <Input
                    type="select"
                    name="colorCategory"
                    id="colorCat"
                    value={cardColorCategory(card) || cardGetLabels(card, 'Color Category')}
                    onChange={(event) => updateField('colorCategory', event.target.value)}
                  >
                    {getLabels(null, 'Color Category').map((colorCat) => (
                      <option key={colorCat}>{colorCat}</option>
                    ))}
                  </Input>
                </InputGroup>

                <h5>Notes</h5>
                <InputGroup className="mb-3">
                  <Input
                    type="textarea"
                    name="notes"
                    value={card.notes || ''}
                    onChange={(event) => updateField('notes', event.target.value)}
                  />
                </InputGroup>

                <h5>Tags</h5>
                <TagInput
                  tags={cardTags(card).map((tag) => ({ text: tag, id: tag }))}
                  readOnly={!canEdit}
                  inputValue={tagInput}
                  handleInputChange={setTagInput}
                  handleInputBlur={(tag) => {
                    updateField('tags', [...cardTags(card), tag.text]);
                    setTagInput('');
                  }}
                  addTag={(tag) => {
                    updateField('tags', [...cardTags(card), tag.text]);
                    setTagInput('');
                  }}
                  deleteTag={(index) => {
                    const newTags = [...cardTags(card)];
                    newTags.splice(index, 1);
                    updateField('tags', newTags);
                  }}
                  reorderTag={(oldIndex, newIndex) => {
                    const newTags = [...cardTags(card)];
                    const tag = newTags.splice(oldIndex, 1)[0];
                    newTags.splice(newIndex, 0, tag);
                    updateField('tags', newTags);
                  }}
                  tagColors={tagColors}
                />
              </fieldset>
            </Col>
          </Row>
        ) : (
          <Spinner size="lg" />
        )}
      </ModalBody>
    </Modal>
  );
};

CardModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  card: CardPropType.isRequired,
  canEdit: PropTypes.bool,
  versionDict: PropTypes.shape({}),
  editCard: PropTypes.func.isRequired,
  revertEdit: PropTypes.func.isRequired,
  revertRemove: PropTypes.func.isRequired,
  removeCard: PropTypes.func.isRequired,
  tagColors: PropTypes.arrayOf(PropTypes.string),
  moveCard: PropTypes.func.isRequired,
};

CardModal.defaultProps = {
  canEdit: false,
  versionDict: {},
  tagColors: [],
};

export default CardModal;
