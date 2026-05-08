import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ArrowSwitchIcon, PlusIcon, TrashIcon, XIcon } from '@primer/octicons-react';
import {
  cardColorCategory,
  cardColorIdentity,
  cardFinish,
  cardImageBackUrl,
  cardImageUrl,
  cardName,
  cardRarity,
  cardStatus,
  cardTags,
  cardType,
  isCardCmcValid,
  normalizeName,
} from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import Card, { BoardType, CARD_STATUSES, FINISHES, VoucherCard } from '@utils/datatypes/Card';
import { getBoardDefinitions, TagColor } from '@utils/datatypes/Cube';
import TagData from '@utils/datatypes/TagData';
import { getLabels } from '@utils/sorting/Sort';
import { getTagColorClass } from '@utils/Util';

import ImageFallback from 'components/ImageFallback';

import { CSRFContext } from '../../contexts/CSRFContext';
import CubeContext from '../../contexts/CubeContext';
import DisplayContext from '../../contexts/DisplayContext';
import { getCard } from '../../utils/cards/getCard';
import AutocompleteInput from '../base/AutocompleteInput';
import Badge from '../base/Badge';
import Button from '../base/Button';
import Input from '../base/Input';
import { Col, Flexbox, Row } from '../base/Layout';
import Link from '../base/Link';
import { ListGroup, ListGroupItem } from '../base/ListGroup';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Tag from '../base/Tag';
import Text from '../base/Text';
import TextArea from '../base/TextArea';
import BoardMoveControl from '../BoardMoveControl';
import { ColorChecksAddon } from '../ColorCheck';
import TagInput from '../TagInput';
import AutocardListItem from './AutocardListItem';

export interface VoucherCardModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  card: Card;
  canEdit?: boolean;
  versionDict: Record<string, any[]>;
  fetchVersionsForCard: (cardId: string) => Promise<boolean>;
  editCard: (index: number, card: Card, board: BoardType) => void | Promise<void>;
  revertEdit: (index: number, board: BoardType) => void;
  revertRemove: (index: number, board: BoardType) => void;
  removeCard: (index: number, board: BoardType) => void;
  tagColors: TagColor[];
  moveCard: (index: number, board: BoardType, newBoard: BoardType) => void;
  allTags: string[];
}

// Selection can be 'voucher' (the parent) or a sub-card index
type Selection = 'voucher' | number;

const VoucherCardModal: React.FC<VoucherCardModalProps> = ({
  isOpen,
  setOpen,
  card,
  canEdit = false,
  versionDict,
  fetchVersionsForCard,
  editCard,
  revertEdit,
  revertRemove,
  removeCard,
  tagColors,
  moveCard,
  allTags,
}) => {
  const [targetBoard, setTargetBoard] = useState<string>('');
  const [searchValue, setSearchValue] = useState('');
  const [selection, setSelection] = useState<Selection>('voucher');
  const [subCardVersions, setSubCardVersions] = useState<Record<string, any>>({});
  const [subCardVersionsLoading, setSubCardVersionsLoading] = useState(false);
  const fetchedSubCardsRef = useRef<Set<string>>(new Set());
  const { cube, unfilteredChangedCards, addCard } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const { setRightSidebarMode, showCustomImages } = useContext(DisplayContext);

  const voucherCards: VoucherCard[] = useMemo(() => card.voucher_cards || [], [card.voucher_cards]);

  // Reset selection when modal opens or card changes
  useEffect(() => {
    setSelection('voucher');
  }, [card.cardID, isOpen]);

  // Get available boards from cube
  const availableBoards = useMemo(() => {
    return getBoardDefinitions(cube, unfilteredChangedCards);
  }, [cube, unfilteredChangedCards]);

  // Set initial target board to first board that isn't the current board
  useEffect(() => {
    if (card.board && availableBoards.length > 0) {
      const otherBoard = availableBoards.find((b) => b.name.toLowerCase() !== card.board);
      if (otherBoard && (!targetBoard || targetBoard === card.board)) {
        setTargetBoard(otherBoard.name.toLowerCase());
      }
    }
  }, [card.board, availableBoards, targetBoard]);

  // Fetch versions for selected sub-card
  useEffect(() => {
    if (typeof selection === 'number') {
      const subCard = voucherCards[selection];
      if (subCard?.details?.name) {
        const cardNorm = normalizeName(subCard.details.name);
        const cardVersions = versionDict[cardNorm];

        if (!cardVersions && subCard.cardID && !fetchedSubCardsRef.current.has(subCard.cardID)) {
          // Versions not loaded yet - fetch them
          setSubCardVersionsLoading(true);
          setSubCardVersions({});
          fetchedSubCardsRef.current.add(subCard.cardID);

          fetchVersionsForCard(subCard.cardID).finally(() => {
            setSubCardVersionsLoading(false);
          });
        } else if (cardVersions) {
          // Versions already loaded
          setSubCardVersions(Object.fromEntries(cardVersions.map((v: any) => [v.scryfall_id, v])));
          setSubCardVersionsLoading(false);
        } else {
          setSubCardVersionsLoading(false);
        }
      }
    }
  }, [selection, voucherCards, versionDict, fetchVersionsForCard]);

  const disabled = !canEdit || card.markedForDelete;

  const getCardFrontImage = useCallback(
    (card: Card) => {
      return (showCustomImages && cardImageUrl(card)) || card?.details?.image_normal;
    },
    [showCustomImages],
  );
  const getCardBackImage = function (card: Card) {
    return (showCustomImages && cardImageBackUrl(card)) || card?.details?.image_flip;
  };

  const [prevCardID, setPrevCardID] = useState(card.cardID);
  const [isFrontImage, setIsFrontImage] = useState(true);
  const [imageUsed, setImageUsed] = useState(getCardFrontImage(card));

  if (prevCardID !== card.cardID) {
    setIsFrontImage(true);
    setPrevCardID(card.cardID);
    setImageUsed(getCardFrontImage(card));
  } else if (isFrontImage && getCardFrontImage(card) !== imageUsed) {
    setImageUsed(getCardFrontImage(card));
  } else if (!isFrontImage && getCardBackImage(card) !== imageUsed) {
    setImageUsed(getCardBackImage(card));
  }

  const updateField = useCallback(
    (field: keyof Card, value: any) => {
      if (field === 'imgBackUrl' && value.trim() === '' && !card?.details?.image_flip && !isFrontImage) {
        setIsFrontImage(true);
        setImageUsed(getCardFrontImage(card));
      }
      editCard(card.index!, { ...card, [field]: value }, card.board!);
      if (canEdit && window.innerWidth >= 768) {
        setRightSidebarMode('edit');
      }
    },
    [card, editCard, getCardFrontImage, isFrontImage, canEdit, setRightSidebarMode],
  );

  const doCmcValidity = useCallback((input: HTMLInputElement) => {
    if (input.validity.patternMismatch) {
      input.setCustomValidity('Mana Value must be a non-negative number (integer or decimal).');
    } else if (input.validity.valueMissing) {
      input.setCustomValidity('Mana Value must be set.');
    } else {
      input.setCustomValidity('');
    }
    input.reportValidity();
  }, []);

  const onCmcChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      updateField('cmc', input.value);
      doCmcValidity(input);
    },
    [updateField, doCmcValidity],
  );

  const revertAction = useCallback(() => {
    if (card.editIndex !== undefined && card.board !== undefined) {
      revertEdit(card.editIndex, card.board);
    }
  }, [revertEdit, card]);

  // Voucher content management
  const handleAddCard = useCallback(
    async (event: React.FormEvent<HTMLInputElement>, match?: string) => {
      event.preventDefault();
      const name = match || searchValue;
      if (!name) return;

      const defaultPrinting = cube?.defaultPrinting || 'recent';
      const details = await getCard(csrfFetch, defaultPrinting, name);
      if (!details) return;

      const newVoucherCard: VoucherCard = {
        cardID: details.scryfall_id,
        status: 'Not Owned',
        finish: 'Non-foil',
        details,
      };

      const updatedCards = [...voucherCards, newVoucherCard];
      editCard(card.index!, { ...card, voucher_cards: updatedCards }, card.board!);
      setSearchValue('');
    },
    [searchValue, csrfFetch, cube?.defaultPrinting, voucherCards, editCard, card],
  );

  const handleUpdateVoucherCard = useCallback(
    (index: number, updated: VoucherCard) => {
      const updatedCards = [...voucherCards];
      updatedCards[index] = updated;
      editCard(card.index!, { ...card, voucher_cards: updatedCards }, card.board!);
    },
    [voucherCards, editCard, card],
  );

  const handleRemoveVoucherCard = useCallback(
    (index: number) => {
      const updatedCards = voucherCards.filter((_, i) => i !== index);
      editCard(card.index!, { ...card, voucher_cards: updatedCards }, card.board!);
      // If we were viewing the removed card, go back to voucher
      if (selection === index) {
        setSelection('voucher');
      } else if (typeof selection === 'number' && selection > index) {
        // Adjust selection index if we removed a card before the selected one
        setSelection(selection - 1);
      }
    },
    [voucherCards, editCard, card, selection],
  );

  // Get the currently selected sub-card (if any)
  const selectedSubCard = typeof selection === 'number' ? voucherCards[selection] : null;

  // Image for selected item
  const getSelectedImage = useCallback(() => {
    if (selection === 'voucher') {
      return imageUsed;
    }
    if (selectedSubCard) {
      return selectedSubCard.imgUrl || selectedSubCard.details?.image_normal || cdnUrl('/content/default_card.png');
    }
    return cdnUrl('/content/default_card.png');
  }, [selection, imageUsed, selectedSubCard]);

  return (
    <Modal lg isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        {cardName(card)}
        &nbsp;
        <Badge color="primary">Voucher</Badge>
        &nbsp;
        {card.markedForDelete && (
          <>
            <Badge color="danger">Marked for Removal</Badge>&nbsp;
          </>
        )}
        {card.editIndex !== undefined && (
          <>
            <Badge color="warning">*Pending Edit*</Badge>&nbsp;
          </>
        )}
      </ModalHeader>
      <ModalBody>
        <Row>
          {/* LEFT SIDE: Voucher Contents List */}
          <Col xs={12} sm={5}>
            <Flexbox direction="col" gap="2">
              <Flexbox direction="row" justify="between" alignItems="center">
                <Text md semibold>
                  Voucher Contents
                </Text>
                <Text sm className="text-text-secondary">
                  {voucherCards.length} card{voucherCards.length !== 1 ? 's' : ''}
                </Text>
              </Flexbox>

              {canEdit && (
                <Flexbox direction="row" gap="2" alignItems="center">
                  <div className="flex-1">
                    <AutocompleteInput
                      treeUrl="/cube/api/cardnames"
                      treePath="cardnames"
                      value={searchValue}
                      setValue={setSearchValue}
                      onSubmit={handleAddCard}
                      placeholder="Add a card..."
                      autoComplete="off"
                      showImages={false}
                    />
                  </div>
                  <Button color="primary" onClick={(e: any) => handleAddCard(e)} className="px-2 py-1">
                    <PlusIcon size={14} />
                  </Button>
                </Flexbox>
              )}

              <Text sm className="text-text-secondary mb-1">
                When drafted, the player receives these cards instead of the voucher.
              </Text>

              <div className="overflow-y-auto max-h-1/2 border border-border-secondary rounded-md">
                <ListGroup>
                  {/* Voucher itself as selectable item */}
                  <ListGroupItem
                    onClick={() => setSelection('voucher')}
                    first
                    className={selection === 'voucher' ? 'bg-bg-active font-bold' : ''}
                  >
                    <Flexbox direction="row" justify="between" alignItems="center">
                      <span className={selection === 'voucher' ? 'font-bold' : ''}>
                        📦 {card.custom_name || 'Voucher'} (self)
                      </span>
                    </Flexbox>
                  </ListGroupItem>

                  {voucherCards.length === 0 ? (
                    <ListGroupItem last>
                      <Text sm className="text-text-secondary py-2 text-center">
                        No cards yet
                      </Text>
                    </ListGroupItem>
                  ) : (
                    voucherCards.map((vc, i) => {
                      const isSelected = selection === i;
                      const isLast = i === voucherCards.length - 1;
                      // Create a pseudo-Card for AutocardListItem
                      const pseudoCard = {
                        ...vc,
                        details: vc.details,
                      } as Card;
                      return (
                        <AutocardListItem
                          key={`${vc.cardID}-${i}`}
                          card={pseudoCard}
                          onClick={() => setSelection(i)}
                          inModal
                          noCardModal
                          last={isLast}
                          isSelected={isSelected}
                        >
                          {canEdit && (
                            <span onClick={(e) => e.stopPropagation()}>
                              <Link onClick={() => handleRemoveVoucherCard(i)}>
                                <XIcon size={16} />
                              </Link>
                            </span>
                          )}
                        </AutocardListItem>
                      );
                    })
                  )}
                </ListGroup>
              </div>

              {/* Selected card preview */}
              <div className="mt-2">
                <ImageFallback
                  src={getSelectedImage()}
                  fallbackSrc={cdnUrl('/content/default_card.png')}
                  alt={selection === 'voucher' ? cardName(card) : selectedSubCard?.details?.name || 'Card'}
                  className="w-full rounded"
                />
              </div>

              <Text xs className="text-text-secondary">
                When drafted, the player receives these cards instead of the voucher.
              </Text>
            </Flexbox>
          </Col>

          {/* RIGHT SIDE: Edit Panel */}
          <Col xs={12} sm={7}>
            {selection === 'voucher' ? (
              // EDITING VOUCHER
              <Flexbox direction="col" gap="2">
                <div className="bg-bg-accent rounded-md px-2 py-1 mb-2">
                  <Text sm semibold>
                    Editing: Voucher
                  </Text>
                </div>

                {getCardBackImage(card) && (
                  <Button
                    color="accent"
                    block
                    onClick={() => {
                      if (isFrontImage) {
                        setImageUsed(getCardBackImage(card));
                        setIsFrontImage(false);
                      } else {
                        setImageUsed(getCardFrontImage(card));
                        setIsFrontImage(true);
                      }
                    }}
                  >
                    <ArrowSwitchIcon size={16} /> Transform {isFrontImage ? '(To back)' : '(To front)'}
                  </Button>
                )}
                {canEdit && card.board && (
                  <Button
                    color="accent"
                    block
                    outline
                    onClick={() => {
                      const {
                        index: _index,
                        board: _board,
                        details: _details,
                        editIndex: _ei,
                        removeIndex: _ri,
                        markedForDelete: _md,
                        ...copy
                      } = card;
                      addCard(copy as Card, card.board!);
                      if (window.innerWidth >= 768) {
                        setRightSidebarMode('edit');
                      }
                      setOpen(false);
                    }}
                  >
                    Add a Copy
                  </Button>
                )}

                <Input
                  label="Name"
                  type="text"
                  name="custom_name"
                  value={card.custom_name || ''}
                  onChange={(event) => updateField('custom_name', event.target.value)}
                  disabled={disabled}
                  required
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
                  value={`${card.cmc ?? card.details?.cmc ?? ''}`}
                  onChange={onCmcChange}
                  disabled={disabled}
                  valid={isCardCmcValid(card.cmc ?? card.details?.cmc).valid ? undefined : false}
                  placeholder={`${card.details?.cmc ?? ''}`}
                  otherInputProps={{
                    required: true,
                    pattern: '[0-9.]+',
                  }}
                />
                <Input
                  label="Type"
                  type="text"
                  name="type_line"
                  value={cardType(card)}
                  onChange={(event) => updateField('type_line', event.target.value)}
                  disabled={disabled}
                  required
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
                      const existingTags = cardTags(card);
                      if (!existingTags.includes(tag.text)) {
                        updateField('tags', [...cardTags(card), tag.text]);
                      }
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
                      <Tag key={tag} colorClass={getTagColorClass(tagColors, tag)} text={tag} />
                    ))}
                  </Flexbox>
                )}
              </Flexbox>
            ) : selectedSubCard ? (
              // EDITING SUB-CARD
              <Flexbox direction="col" gap="2">
                <div className="bg-bg-activeOption rounded-md px-2 py-1 mb-2">
                  <Text sm semibold>
                    Editing: {selectedSubCard.details?.name || 'Sub-card'}
                  </Text>
                </div>

                <Select
                  label="Version"
                  value={selectedSubCard.cardID}
                  setValue={(v) => {
                    const newDetails = subCardVersions[v];
                    if (newDetails) {
                      handleUpdateVoucherCard(selection as number, {
                        ...selectedSubCard,
                        cardID: v,
                        // Merge existing details with new version details (like CubeContext does)
                        details: {
                          ...selectedSubCard.details,
                          ...newDetails,
                        },
                      });
                    }
                  }}
                  options={Object.entries(subCardVersions).map(([key, value]) => ({
                    value: key,
                    label: value.version,
                  }))}
                  disabled={!canEdit}
                  loading={subCardVersionsLoading}
                />

                <Select
                  label="Status"
                  value={selectedSubCard.status || 'Not Owned'}
                  setValue={(v) => handleUpdateVoucherCard(selection as number, { ...selectedSubCard, status: v })}
                  options={CARD_STATUSES.map((s) => ({ value: s, label: s }))}
                  disabled={!canEdit}
                />
                <Select
                  label="Finish"
                  value={selectedSubCard.finish?.toString() || 'Non-foil'}
                  setValue={(v) => handleUpdateVoucherCard(selection as number, { ...selectedSubCard, finish: v })}
                  options={FINISHES.map((f) => ({ value: f, label: f }))}
                  disabled={!canEdit}
                />
                <Input
                  label="Custom Image URL (optional)"
                  type="text"
                  name="imgUrl"
                  value={selectedSubCard.imgUrl || ''}
                  onChange={(event) =>
                    handleUpdateVoucherCard(selection as number, {
                      ...selectedSubCard,
                      imgUrl: event.target.value || undefined,
                    })
                  }
                  disabled={!canEdit}
                  placeholder="Leave blank to use default"
                />

                {canEdit && (
                  <Button
                    color="danger"
                    block
                    className="mt-2"
                    onClick={() => handleRemoveVoucherCard(selection as number)}
                  >
                    <TrashIcon size={14} /> Remove from Voucher
                  </Button>
                )}
              </Flexbox>
            ) : (
              <Text className="text-text-secondary">Select a card from the list</Text>
            )}
          </Col>
        </Row>
      </ModalBody>
      {canEdit && (
        <ModalFooter className="items-stretch">
          {card.markedForDelete ? (
            <>
              <Button
                color="primary"
                block
                className="items-center text-sm"
                onClick={() => revertRemove(card.removeIndex!, card.board!)}
              >
                Revert Removal
              </Button>
              &nbsp;
            </>
          ) : (
            <>
              <Button
                color="danger"
                block
                className="items-center text-sm"
                onClick={() => {
                  removeCard(card.index!, card.board!);
                  if (window.innerWidth >= 768) {
                    setRightSidebarMode('edit');
                  }
                  setOpen(false);
                }}
              >
                Remove
              </Button>
              &nbsp;
              {availableBoards.length > 1 && (
                <>
                  <BoardMoveControl
                    currentBoard={card.board}
                    targetBoard={targetBoard}
                    setTargetBoard={setTargetBoard}
                    availableBoards={availableBoards}
                    buttonText="Move To"
                    onMove={() => {
                      if (targetBoard) {
                        moveCard(card.index!, card.board!, targetBoard as BoardType);
                        if (window.innerWidth >= 768) {
                          setRightSidebarMode('edit');
                        }
                        setOpen(false);
                      }
                    }}
                  />
                  &nbsp;
                </>
              )}
            </>
          )}
          {card.editIndex !== undefined && (
            <>
              <Button color="primary" block className="items-center text-sm" onClick={revertAction}>
                Revert Edit
              </Button>
              &nbsp;
            </>
          )}
          &nbsp;
        </ModalFooter>
      )}
    </Modal>
  );
};

export default VoucherCardModal;
