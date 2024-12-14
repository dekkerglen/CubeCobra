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
import Tag from 'components/base/Tag';

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

  const disabled = !canEdit || card.markedForDelete;

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
              <Flexbox direction="col" gap="2">
                <FoilCardImage card={card} finish={card.finish} />
                <Flexbox direction="row" gap="2" wrap="wrap">
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
                </Flexbox>
                {canEdit && (
                  <>
                    {card.markedForDelete ? (
                      <Button
                        color="primary"
                        block
                        outline
                        onClick={() => revertRemove(card.removeIndex!, card.board!)}
                      >
                        Revert Removal
                      </Button>
                    ) : (
                      <>
                        <Button
                          color="danger"
                          block
                          outline
                          onClick={() => {
                            removeCard(card.index!, card.board!);
                            setOpen(false);
                          }}
                        >
                          Remove from cube
                        </Button>
                        {card.board === 'mainboard' ? (
                          <Button
                            color="accent"
                            block
                            outline
                            onClick={() => {
                              moveCard(card.index!, card.board!, 'maybeboard');
                              setOpen(false);
                            }}
                          >
                            Move to Maybeboard
                          </Button>
                        ) : (
                          <Button
                            color="accent"
                            block
                            outline
                            onClick={() => {
                              moveCard(card.index!, card.board!, 'mainboard');
                              setOpen(false);
                            }}
                          >
                            Move to Mainboard
                          </Button>
                        )}
                      </>
                    )}
                    {card.editIndex !== undefined && (
                      <Button
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
                    )}
                  </>
                )}
                <Button block outline color="accent" href={card.details?.scryfall_uri} target="_blank">
                  View on Scryfall
                </Button>
                <Button block outline color="accent" href={`/tool/card/${card.cardID}`} target="_blank">
                  View Card Analytics
                </Button>
                {card.details && (
                  <Button className="my-1" block outline color="accent" href={getTCGLink(card)} target="_blank">
                    Buy
                  </Button>
                )}
              </Flexbox>
            </Col>
            <Col xs={12} sm={8}>
              <Flexbox direction="col" gap="2">
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
                  disabled={disabled}
                />
                <Select
                  label="Status"
                  value={cardStatus(card)}
                  setValue={(v) => updateField('status', v)}
                  options={getLabels(null, 'Status', false).map((status) => ({
                    value: status,
                    label: status,
                  }))}
                  disabled={disabled}
                />
                <Select
                  label="Finish"
                  value={cardFinish(card)}
                  setValue={(v) => updateField('finish', v)}
                  options={getLabels(null, 'Finish', false).map((finish) => ({
                    value: finish,
                    label: finish,
                  }))}
                  disabled={disabled}
                />
                <Input
                  label="Mana Value"
                  type="text"
                  name="cmc"
                  value={`${cardCmc(card)}`}
                  onChange={(event) => updateField('cmc', event.target.value)}
                  disabled={disabled}
                />
                <Input
                  label="Type"
                  type="text"
                  name="type_line"
                  value={cardType(card)}
                  onChange={(event) => updateField('type_line', event.target.value)}
                  disabled={disabled}
                />
                <Select
                  label="Rarity"
                  value={cardRarity(card)}
                  setValue={(v) => updateField('rarity', v)}
                  options={getLabels(null, 'Rarity', false).map((rarity) => ({
                    value: rarity.toLowerCase(),
                    label: rarity,
                  }))}
                  disabled={disabled}
                />
                <Input
                  label="Image URL"
                  type="text"
                  name="imgUrl"
                  value={card.imgUrl || ''}
                  onChange={(event) => updateField('imgUrl', event.target.value)}
                  disabled={disabled}
                />
                <Input
                  label="Image Back URL"
                  type="text"
                  name="imgBackUrl"
                  value={card.imgBackUrl || ''}
                  onChange={(event) => updateField('imgBackUrl', event.target.value)}
                  disabled={disabled}
                />
                <ColorChecksAddon
                  label="Color"
                  values={cardColorIdentity(card)}
                  setValues={(colors: string[]) => updateField('colors', colors)}
                  disabled={disabled}
                />
                <Select
                  label="Color Category"
                  value={cardColorCategory(card)}
                  setValue={(v) => updateField('colorCategory', v)}
                  options={[
                    {
                      value: '',
                      label: '',
                    },
                    ...getLabels(null, 'Color Category', false).map((category) => ({
                      value: category,
                      label: category,
                    })),
                  ]}
                  disabled={disabled}
                />
                <Text md semibold>
                  Notes
                </Text>
                <TextArea
                  name="notes"
                  value={card.notes || ''}
                  onChange={(event) => updateField('notes', event.target.value)}
                  disabled={disabled}
                />
                <Text md semibold>
                  Tags
                </Text>
                {!disabled ? (
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
                ) : (
                  <Flexbox direction="row" gap="2" wrap="wrap">
                    {cardTags(card).map((tag) => (
                      <Tag key={tag} color="accent" text={tag} />
                    ))}
                  </Flexbox>
                )}
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
