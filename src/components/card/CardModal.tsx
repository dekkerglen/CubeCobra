import React, { useCallback, useEffect, useState } from 'react';

import { ColorChecksAddon } from 'components/ColorCheck';
import FoilCardImage from 'components/FoilCardImage';
import TagInput from 'components/TagInput';
import TextBadge from 'components/TextBadge';
import Badge from 'components/base/Badge';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import Tooltip from 'components/base/Tooltip';
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
import { getLabels } from 'utils/Sort';

export interface CardModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
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
  setOpen,
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

  return (
    <Modal xl isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        {cardName(card)} {card.markedForDelete && <Badge color="danger">Marked for Removal</Badge>}
        {card.editIndex !== undefined && <Badge color="warning">*Pending Edit*</Badge>}
      </ModalHeader>
      <ModalBody>
        {versions ? (
          <Row>
            <Col xs={12} sm={4}>
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
                      <Col xs={12}>
                        <Button
                          className="my-1"
                          color="primary"
                          block
                          outline
                          onClick={() => revertRemove(card.removeIndex!, card.board!)}
                        >
                          Revert Removal
                        </Button>
                      </Col>
                    ) : (
                      <>
                        <Col xs={12}>
                          <Button
                            className="my-1"
                            color="danger"
                            block
                            outline
                            onClick={() => {
                              removeCard(card.index!, card.board!);
                              setOpen(false);
                            }}
                          >
                            <span className="d-none d-sm-inline">Remove from cube</span>
                            <span className="d-sm-none">Remove</span>
                          </Button>
                        </Col>
                        {card.board === 'mainboard' ? (
                          <Col xs={12}>
                            <Button
                              className="my-1"
                              color="accent"
                              block
                              outline
                              onClick={() => {
                                moveCard(card.index!, card.board!, 'maybeboard');
                                setOpen(false);
                              }}
                            >
                              <span className="d-none d-sm-inline">Move to Maybeboard</span>
                              <span className="d-sm-none">Maybeboard</span>
                            </Button>
                          </Col>
                        ) : (
                          <Col xs={12}>
                            <Button
                              className="my-1"
                              color="accent"
                              block
                              outline
                              onClick={() => {
                                moveCard(card.index!, card.board!, 'mainboard');
                                setOpen(false);
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
                      <Col xs={12}>
                        <Button
                          className="my-1"
                          color="primary"
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
                <Col xs={12}>
                  <Button
                    className="my-1"
                    block
                    outline
                    color="accent"
                    href={card.details?.scryfall_uri}
                    target="_blank"
                  >
                    <span className="d-none d-sm-inline">View on Scryfall</span>
                    <span className="d-sm-none">Scryfall</span>
                  </Button>
                </Col>
                <Col xs={12}>
                  <Button
                    className="my-1"
                    block
                    outline
                    color="accent"
                    href={`/tool/card/${card.cardID}`}
                    target="_blank"
                  >
                    <span className="d-none d-sm-inline">View Card Analytics</span>
                    <span className="d-sm-none">Analytics</span>
                  </Button>
                </Col>
                {card.details && (
                  <Col xs={12}>
                    <Button className="my-1" block outline color="accent" href={getTCGLink(card)} target="_blank">
                      Buy
                    </Button>
                  </Col>
                )}
              </Row>
            </Col>
            <Col xs={12} sm={8}>
              <Flexbox direction="col" gap="2">
                <Text md semibold>
                  Card Attributes
                </Text>
                <Select
                  label="Version"
                  value={card.cardID}
                  setValue={(v) => updateField('cardID', v)}
                  options={Object.entries(versions!).map(([key, value]) => {
                    return {
                      value: key,
                      label: value.version,
                    };
                  })}
                />
                <Select
                  label="Status"
                  value={cardStatus(card)}
                  setValue={(v) => updateField('status', v)}
                  options={getLabels(null, 'Status', false).map((status) => ({
                    value: status,
                    label: status,
                  }))}
                />
                <Select
                  label="Finish"
                  value={cardFinish(card)}
                  setValue={(v) => updateField('finish', v)}
                  options={getLabels(null, 'Finish', false).map((finish) => ({
                    value: finish,
                    label: finish,
                  }))}
                />
                <Input
                  label="Mana Value"
                  type="text"
                  name="cmc"
                  value={`${cardCmc(card)}`}
                  onChange={(event) => updateField('cmc', event.target.value)}
                />
                <Input
                  label="Type"
                  type="text"
                  name="type_line"
                  value={cardType(card)}
                  onChange={(event) => updateField('type_line', event.target.value)}
                />
                <Select
                  label="Rarity"
                  value={cardRarity(card)}
                  setValue={(v) => updateField('rarity', v)}
                  options={getLabels(null, 'Rarity', false).map((rarity) => ({
                    value: rarity.toLowerCase(),
                    label: rarity,
                  }))}
                />
                <Input
                  label="Image URL"
                  type="text"
                  name="imgUrl"
                  value={card.imgUrl || ''}
                  onChange={(event) => updateField('imgUrl', event.target.value)}
                />
                <Input
                  label="Image Back URL"
                  type="text"
                  name="imgBackUrl"
                  value={card.imgBackUrl || ''}
                  onChange={(event) => updateField('imgBackUrl', event.target.value)}
                />
                <Flexbox direction="row" gap="1">
                  <Text semibold>Color</Text>
                  <ColorChecksAddon
                    values={cardColorIdentity(card)}
                    setValues={(colors: string[]) => updateField('colors', colors)}
                  />
                </Flexbox>
                <Select
                  label="Color Category"
                  value={cardColorCategory(card)}
                  setValue={(v) => updateField('colorCategory', v)}
                  options={getLabels(null, 'Color Category', false).map((category) => ({
                    value: category,
                    label: category,
                  }))}
                />
                <Text md semibold>
                  Notes
                </Text>
                <TextArea
                  name="notes"
                  value={card.notes || ''}
                  onChange={(event) => updateField('notes', event.target.value)}
                />
                <Text md semibold>
                  Tags
                </Text>
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
                  tagColors={tagColors}
                  suggestions={allTags}
                />
              </Flexbox>
            </Col>
          </Row>
        ) : (
          <Spinner lg />
        )}
      </ModalBody>
    </Modal>
  );
};

export default CardModal;
