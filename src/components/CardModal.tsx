import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Col,
  Input,
  InputGroup,
  InputGroupText,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
  Spinner,
} from 'reactstrap';

import { ColorChecksAddon } from 'components/ColorCheck';
import FoilCardImage from 'components/FoilCardImage';
import TagInput from 'components/TagInput';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import Card, { BoardType } from 'datatypes/Card';
import { TagColor } from 'datatypes/Cube';
import TagData from 'datatypes/TagData';
import { getTCGLink } from 'utils/Affiliate';
import {
  cardCmc,
  cardColorCategory,
  cardColorIdentity,
  cardElo,
  cardEtchedPrice,
  cardFinish,
  cardFoilPrice,
  cardName,
  cardPrice,
  cardPriceEur,
  cardRarity,
  cardStatus,
  cardTags,
  cardTix,
  cardType,
  normalizeName,
} from 'utils/Card';
import { cardGetLabels, getLabels } from 'utils/Sort';

export interface CardModalProps {
  isOpen: boolean;
  toggle: () => void;
  card: Card;
  canEdit?: boolean;
  versionDict: Record<string, CardDetails[]>;
  editCard: (index: number, card: Card, board: BoardType) => void;
  revertEdit: (index: number, board: BoardType) => void;
  revertRemove: (index: number, board: BoardType) => void;
  removeCard: (index: number, board: BoardType) => void;
  tagColors: TagColor[];
  moveCard: (index: number, board: BoardType, newBoard: BoardType) => void;
  allTags: string[];
}

interface CardDetails {
  scryfall_id: string;
  version: string;
}

const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  toggle,
  card,
  canEdit = false,
  versionDict,
  editCard,
  revertEdit,
  revertRemove,
  removeCard,
  tagColors,
  moveCard,
  allTags,
}) => {
  const [versions, setVersions] = useState<Record<string, CardDetails> | null>(null);

  useEffect(() => {
    if (!versionDict[normalizeName(cardName(card))]) {
      setVersions({});
    } else {
      setVersions(Object.fromEntries(versionDict[normalizeName(cardName(card))].map((v) => [v.scryfall_id, v])));
    }
  }, [card, versionDict]);

  const updateField = useCallback(
    (field: keyof Card, value: any) => {
      editCard(card.index!, { ...card, [field]: value }, card.board!);
    },
    [card, editCard],
  );

  const disabled = !canEdit || card.markedForDelete;

  console.log(allTags);

  return (
    <Modal size="xl" isOpen={isOpen} labelledby="cardModalHeader" toggle={toggle}>
      <ModalHeader id="cardModalHeader" toggle={toggle}>
        {cardName(card)} {card.markedForDelete && <Badge color="danger">Marked for Removal</Badge>}
        {card.editIndex !== undefined && <Badge color="warning">*Pending Edit*</Badge>}
      </ModalHeader>
      <ModalBody>
        {versions ? (
          <Row>
            <Col xs="12" sm="4">
              <FoilCardImage card={card} finish={card.finish} />
              <Row className="mb-2 g-0">
                {card.details?.prices && Number.isFinite(cardPrice(card)) && (
                  <TextBadge name="Price" className="mt-2 me-2">
                    <Tooltip text="TCGPlayer Market Price">${cardPrice(card)?.toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details?.prices && Number.isFinite(cardFoilPrice(card)) && (
                  <TextBadge name="Foil" className="mt-2 me-2">
                    <Tooltip text="TCGPlayer Market Price">${cardFoilPrice(card)?.toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details?.prices && Number.isFinite(cardEtchedPrice(card)) && (
                  <TextBadge name="Etched" className="mt-2 me-2">
                    <Tooltip text="TCGPlayer Market Price">${cardEtchedPrice(card)?.toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details?.prices && Number.isFinite(cardPriceEur(card)) && (
                  <TextBadge name="EUR" className="mt-2 me-2">
                    <Tooltip text="Cardmarket Price">€{cardPriceEur(card)?.toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.details?.prices && Number.isFinite(cardTix(card)) && (
                  <TextBadge name="TIX" className="mt-2 me-2">
                    <Tooltip text="MTGO TIX">{cardTix(card)?.toFixed(2)}</Tooltip>
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
                          onClick={() => revertRemove(card.removeIndex!, card.board!)}
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
                              removeCard(card.index!, card.board!);
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
                                moveCard(card.index!, card.board!, 'maybeboard');
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
                                moveCard(card.index!, card.board!, 'mainboard');
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
                          onClick={() => {
                            if (card.editIndex !== undefined && card.board !== undefined) {
                              revertEdit(card.editIndex, card.board);
                            }
                          }}
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
                    href={card.details?.scryfall_uri}
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
                {card.details && (
                  <Col xs="12">
                    <Button className="my-1" block outline color="primary" href={getTCGLink(card)} target="_blank">
                      Buy
                    </Button>
                  </Col>
                )}
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
                    {Object.entries(versions!).map(([key, value]) => {
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
                    {getLabels(null, 'Status', false).map((status) => (
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
                    {getLabels(null, 'Finish', false).map((finish) => (
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
                    {getLabels(null, 'Rarity', false).map((rarity) => (
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
                    values={cardColorIdentity(card)}
                    setValues={(colors: string[]) => updateField('colors', colors)}
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
                  tags={cardTags(card).map((tag): TagData => ({ text: tag, id: tag }))}
                  readOnly={!canEdit}
                  addTag={(tag: TagData) => {
                    updateField('tags', [...cardTags(card), tag.text]);
                  }}
                  deleteTag={(index: number) => {
                    const newTags = [...cardTags(card)];
                    newTags.splice(index, 1);
                    updateField('tags', newTags);
                  }}
                  reorderTag={(_: TagData, oldIndex: number, newIndex: number) => {
                    const newTags = [...cardTags(card)];
                    const newTag = newTags.splice(oldIndex, 1)[0];
                    newTags.splice(newIndex, 0, newTag);
                    updateField('tags', newTags);
                  }}
                  tagColors={tagColors}
                  suggestions={allTags}
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

export default CardModal;
