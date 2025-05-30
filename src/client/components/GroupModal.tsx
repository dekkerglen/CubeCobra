import React, { useCallback, useContext, useMemo, useState } from 'react';

import { XIcon } from '@primer/octicons-react';

import Card, { BoardType, CardStatus } from 'datatypes/Card';
import { TagColor } from 'datatypes/Cube';
import TagData from 'datatypes/TagData';
import { cardEtchedPrice, cardFoilPrice, cardPrice, cardPriceEur, cardTix } from 'utils/cardutil';

import AutocardContext from '../contexts/AutocardContext';
import { getLabels } from '../utils/Sort';
import Button from './base/Button';
import Input from './base/Input';
import { Col, Flexbox, Row } from './base/Layout';
import Link from './base/Link';
import { ListGroup } from './base/ListGroup';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './base/Modal';
import RadioButtonGroup from './base/RadioButtonGroup';
import Select from './base/Select';
import Text from './base/Text';
import Tooltip from './base/Tooltip';
import AutocardListItem from './card/AutocardListItem';
import { ColorChecksAddon } from './ColorCheck';
import CardKingdomBulkButton from './purchase/CardKingdomBulkButton';
import ManaPoolBulkButton from './purchase/ManaPoolBulkButton';
import TagInput from './TagInput';
import TextBadge from './TextBadge';

function cardsWithBoardAndIndex(cards: Card[]): { board: BoardType; index: number }[] {
  return cards.filter((card) => card.board !== undefined && card.index !== undefined) as {
    board: BoardType;
    index: number;
  }[];
}

export interface GroupModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cards: Card[];
  canEdit?: boolean;
  bulkEditCard: (cards: { board: BoardType; index: number }[]) => void;
  bulkMoveCard: (cards: { board: BoardType; index: number }[], board: 'maybeboard' | 'mainboard') => void;
  bulkRevertEdit: (cards: { board: BoardType; index: number }[]) => void;
  bulkRevertRemove: (cards: { board: BoardType; index: number }[]) => void;
  bulkRemoveCard: (cards: { board: BoardType; index: number }[]) => void;
  setModalSelection: (cards: { board: BoardType; index: number }[]) => void;
  allTags: string[];
  tagColors: TagColor[];
}

const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  setOpen,
  cards,
  bulkEditCard,
  bulkMoveCard,
  bulkRevertEdit,
  bulkRevertRemove,
  bulkRemoveCard,
  setModalSelection,
  allTags,
  tagColors,
}) => {
  const [status, setStatus] = useState('');
  const [finish, setFinish] = useState('');
  const [cmc, setCmc] = useState('');
  const [typeLine, setTypeLine] = useState('');
  const [color, setColor] = useState<('W' | 'U' | 'B' | 'R' | 'G')[]>([]);
  const [addTags, setAddTags] = useState(true);
  const [tags, setTags] = useState<{ id: string; text: string }[]>([]);
  const { hideCard } = useContext(AutocardContext);

  const filterOut = useCallback(
    (card: Card) => {
      setModalSelection(
        cardsWithBoardAndIndex(cards.filter((c) => !(c.index === card.index && c.board === card.board))),
      );
      hideCard();
    },
    [cards, hideCard, setModalSelection],
  );

  const removeAll = useCallback(() => {
    bulkRemoveCard(
      cards
        .map((card) => ({
          board: card.board,
          index: card.index,
        }))
        .filter(({ board, index }) => board !== undefined && index !== undefined) as {
        board: BoardType;
        index: number;
      }[],
    );
    setOpen(false);
  }, [bulkRemoveCard, cards, setOpen]);

  const revertRemoval = useCallback(() => {
    bulkRevertRemove(
      cards
        .filter((card) => card.markedForDelete)
        .map((card) => ({
          board: card.board,
          index: card.index,
        }))
        .filter(({ board, index }) => board !== undefined && index !== undefined) as {
        board: BoardType;
        index: number;
      }[],
    );
  }, [bulkRevertRemove, cards]);

  const bulkRevertEditAll = useCallback(() => {
    bulkRevertEdit(
      cards
        .map((card) => ({
          board: card.board,
          index: card.index,
        }))
        .filter(({ board, index }) => board !== undefined && index !== undefined) as {
        board: BoardType;
        index: number;
      }[],
    );
  }, [bulkRevertEdit, cards]);

  const applyChanges = useCallback(() => {
    const updates = JSON.parse(JSON.stringify(cards));

    if (status !== '') {
      updates.forEach((card: Card) => {
        card.status = status as CardStatus;
      });
    }

    if (finish !== '') {
      updates.forEach((card: Card) => {
        card.finish = finish;
      });
    }

    if (cmc !== '') {
      updates.forEach((card: Card) => {
        card.cmc = cmc;
      });
    }

    if (typeLine !== '') {
      updates.forEach((card: Card) => {
        card.type_line = typeLine;
      });
    }

    if (color.length > 0) {
      updates.forEach((card: Card) => {
        if ((color as string[]).includes('C')) {
          card.colors = [];
        } else {
          card.colors = color;
        }
      });
    }

    if (tags.length > 0) {
      if (addTags) {
        updates.forEach((card: Card) => {
          card.tags = [...new Set([...(card.tags || []), ...tags.map((tag) => tag.text)])];
        });
      } else {
        updates.forEach((card: Card) => {
          card.tags = (card.tags || []).filter((tag) => !tags.map((t) => t.text).includes(tag));
        });
      }
    }

    bulkEditCard(updates);
    setModalSelection([]);
    setOpen(false);
  }, [addTags, bulkEditCard, cards, cmc, color, finish, setModalSelection, status, tags, setOpen, typeLine]);

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
    <Modal lg isOpen={isOpen} setOpen={setOpen} scrollable>
      <ModalHeader setOpen={setOpen}>Edit Selected ({cards.length} cards)</ModalHeader>
      <ModalBody scrollable>
        <Row>
          <Col xs={6}>
            <Flexbox direction="col" gap="2">
              <div className="overflow-y-auto max-h-1/2 border border-border-secondary rounded-md">
                <ListGroup>
                  {cards.map((card, index) => (
                    <AutocardListItem
                      key={card.index}
                      card={card}
                      noCardModal
                      inModal
                      last={index === cards.length - 1}
                      first={index === 0}
                    >
                      <Link onClick={() => filterOut(card)}>
                        <XIcon size={16} />
                      </Link>
                    </AutocardListItem>
                  ))}
                </ListGroup>
              </div>
              <Flexbox direction="row" gap="2" wrap="wrap">
                {Number.isFinite(totalPriceUsd) && (
                  <TextBadge name="Price USD" className="mt-2 me-2">
                    <Tooltip text="Market Price">${Math.round(totalPriceUsd).toLocaleString()}</Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(totalPriceUsdFoil) && (
                  <TextBadge name="Foil USD" className="mt-2 me-2">
                    <Tooltip text="Market Foil Price">${Math.round(totalPriceUsdFoil).toLocaleString()}</Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(totalPriceUsdEtched) && (
                  <TextBadge name="Etched USD" className="mt-2 me-2">
                    <Tooltip text="Market Foil Price">${Math.round(totalPriceUsdFoil).toLocaleString()}</Tooltip>
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
              </Flexbox>
              <Text md semibold>
                Purchase
              </Text>
              {/* <TCGPlayerBulkButton cards={cards} /> */}
              <ManaPoolBulkButton cards={cards} />
              <CardKingdomBulkButton cards={cards} />
            </Flexbox>
          </Col>
          <Col xs={6}>
            <Flexbox direction="col" gap="2">
              <Select
                label="Set status of all"
                options={[{ value: '', label: 'None' }].concat(
                  getLabels(null, 'Status', false).map((status: string) => ({
                    value: status,
                    label: status,
                  })),
                )}
                value={status}
                setValue={setStatus}
              />
              <Select
                label="Set finish of all"
                options={[
                  { value: '', label: 'None' },
                  { value: 'Non-foil', label: 'Non-foil' },
                  { value: 'Foil', label: 'Foil' },
                ]}
                value={finish}
                setValue={setFinish}
              />
              <Input label="Mana Value" type="text" name="cmc" value={cmc} onChange={(e) => setCmc(e.target.value)} />
              <Input
                label="Type Line"
                type="text"
                name="type_line"
                value={typeLine}
                onChange={(e) => setTypeLine(e.target.value)}
              />
              <ColorChecksAddon
                label="Color"
                colorless
                values={color}
                setValues={setColor as (values: string[]) => void}
              />
              <Text>
                Selecting no mana symbols will cause the selected cards' color identity to remain unchanged. Selecting
                only colorless will cause the selected cards' color identity to be set to colorless.
              </Text>
              <Text semibold md>
                Edit tags
              </Text>
              <RadioButtonGroup
                options={[
                  { value: 'Add', label: 'Add tags to all' },
                  { value: 'Delete', label: 'Delete tags from all' },
                ]}
                selected={addTags ? 'Add' : 'Delete'}
                setSelected={(selected) => setAddTags(selected === 'Add')}
              />
              <TagInput
                tags={tags}
                addTag={(tag: TagData) => setTags([...tags, tag])}
                deleteTag={(index: number) => {
                  const newTags = [...tags];
                  newTags.splice(index, 1);
                  setTags(newTags);
                }}
                tagColors={tagColors}
                suggestions={allTags}
              />
            </Flexbox>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-2">
        <Button block color="primary" disabled={!fieldsChanged} onClick={applyChanges}>
          Apply all
        </Button>
        <Button block color="danger" onClick={removeAll}>
          Remove all
        </Button>
        <Button
          color="accent"
          block
          onClick={() => {
            bulkMoveCard(cardsWithBoardAndIndex(cards), 'maybeboard');
            setOpen(false);
          }}
        >
          All to Maybeboard
        </Button>
        <Button
          color="accent"
          block
          onClick={() => {
            bulkMoveCard(cardsWithBoardAndIndex(cards), 'mainboard');
            setOpen(false);
          }}
        >
          All to Mainboard
        </Button>
        {anyCardRemoved && (
          <>
            <Button block color="primary" onClick={revertRemoval}>
              Revert removal
            </Button>
          </>
        )}
        {anyCardChanged && (
          <>
            <Button block color="primary" onClick={bulkRevertEditAll}>
              Revert edits
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default GroupModal;
