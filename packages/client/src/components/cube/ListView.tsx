import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { GearIcon } from '@primer/octicons-react';
import {
  cardColorCategory,
  cardColorIdentity,
  cardFullName,
  cardIndex,
  cardName,
  cardNotes,
  cardRarity,
  cardTags,
  cardType,
  isCardCmcValid,
  normalizeName,
} from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import TagData from '@utils/datatypes/TagData';
import { getLabels, sortForDownload } from '@utils/sorting/Sort';

import Button from 'components/base/Button';
import { Card } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import PagedTable from 'components/PagedTable';
import TagInput from 'components/TagInput';
import withAutocard from 'components/WithAutocard';
import CubeContext from 'contexts/CubeContext';
import useLocalStorage from 'hooks/useLocalStorage';

import ListViewSettingsModal, { ListViewColumn } from '../modals/ListViewSettingsModal';
import withCardModal from '../modals/WithCardModal';
import withGroupModal from '../modals/WithGroupModal';

const GroupModalButton = withGroupModal(Button);

const AutoCardLink = withAutocard(Link);
const CardModalLink = withCardModal(AutoCardLink);

// Card fields that can be overridden per-card, exposed as toggleable columns.
// The Name column is always shown (it holds the selection checkbox and card link),
// so it is intentionally not part of this list.
const TOGGLEABLE_COLUMNS: ListViewColumn[] = [
  { key: 'version', label: 'Version' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'finish', label: 'Finish' },
  { key: 'cmc', label: 'CMC' },
  { key: 'colorIdentity', label: 'Color Identity' },
  { key: 'colorCategory', label: 'Color Category' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'notes', label: 'Notes' },
  { key: 'tags', label: 'Tags' },
];

// Preserves the columns that were shown before this setting existed.
const DEFAULT_VISIBLE_COLUMNS = ['version', 'type', 'status', 'finish', 'cmc', 'colorIdentity', 'tags'];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Scryfall rarities, stored lowercase to match card.details.rarity.
const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'];

const colorCombos = [
  'C',
  'W',
  'U',
  'B',
  'R',
  'G',
  'WU',
  'WB',
  'WR',
  'WG',
  'UB',
  'UR',
  'UG',
  'BR',
  'BG',
  'RG',
  'WUB',
  'WUR',
  'WUG',
  'WBR',
  'WBG',
  'WRG',
  'UBR',
  'UBG',
  'URG',
  'BRG',
  'WUBR',
  'WUBG',
  'WURG',
  'WBRG',
  'UBRG',
  'WUBRG',
];

const defaultVersions = (card: CardType) => {
  const fullName = cardFullName(card);
  return [
    {
      ...card.details,
      version: fullName.toUpperCase().substring(fullName.indexOf('[') + 1, fullName.indexOf(']')),
    },
  ];
};

interface ListViewProps {
  cards: CardType[];
}

const ListView: React.FC<ListViewProps> = ({ cards }) => {
  const { versionDict, fetchVersionsForCard, editCard, tagColors, allTags, canEdit } = useContext(CubeContext);
  const [checked, setChecked] = useState<{ [key: string]: boolean }>({});
  const [pageSize, setPageSize] = useLocalStorage<number>('listViewPageSize', 50);
  const [visibleColumns, setVisibleColumns] = useLocalStorage<string[]>('listViewColumns', DEFAULT_VISIBLE_COLUMNS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set());

  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube } = useContext(CubeContext);

  // Reset checked state when card indices change structurally (e.g., after a commit
  // that removes cards and reassigns indices), so stale index keys don't incorrectly
  // match different cards.
  const cardIndexKey = useMemo(
    () =>
      cards
        .map((c) => cardIndex(c))
        .sort((a, b) => a - b)
        .join(','),
    [cards],
  );

  useEffect(() => {
    setChecked({});
  }, [cardIndexKey]);

  const sorted = useMemo(
    () =>
      sortForDownload(
        cards,
        sortPrimary || 'Color Category',
        sortSecondary || 'Types-Multicolor',
        sortTertiary || 'CMC',
        sortQuaternary || 'Alphabetical',
        cube.showUnsorted || false,
        cube,
      ),
    [cards, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube],
  );

  const handleCheck = useCallback(
    (card: CardType) => {
      setChecked((prevChecked) => ({
        ...prevChecked,
        [cardIndex(card)]: !prevChecked[cardIndex(card)],
      }));
    },
    [setChecked],
  );

  const handleCheckAll = useCallback(() => {
    const allChecked = cards.every((card) => checked[cardIndex(card)]);
    const newChecked = cards.reduce(
      (acc, card) => {
        acc[cardIndex(card)] = !allChecked;
        return acc;
      },
      {} as { [key: string]: boolean },
    );
    setChecked(newChecked);
  }, [cards, checked]);

  const updateField = useCallback(
    (card: CardType, field: any, value: any) => {
      editCard(cardIndex(card), { ...card, [field]: value }, card.board || 'mainboard');
    },
    [editCard],
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
    (card: CardType, e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      updateField(card, 'cmc', input.value);
      doCmcValidity(input);
    },
    [updateField, doCmcValidity],
  );

  // Lazy load versions when user interacts with version dropdown
  const handleVersionDropdownFocus = useCallback(
    async (card: CardType) => {
      const cardNorm = normalizeName(cardName(card));
      // Only fetch if versions aren't already loaded and not currently loading
      if (!versionDict[cardNorm] && !loadingVersions.has(card.cardID)) {
        setLoadingVersions((prev) => new Set(prev).add(card.cardID));
        await fetchVersionsForCard(card.cardID);
        setLoadingVersions((prev) => {
          const next = new Set(prev);
          next.delete(card.cardID);
          return next;
        });
      }
    },
    [versionDict, loadingVersions, fetchVersionsForCard],
  );

  // Renders the editable cell for each overridable column, keyed by column id.
  const columnRenderers: Record<string, (card: CardType) => React.ReactNode> = {
    version: (card) => (
      <Select
        value={card.cardID}
        setValue={(v) => updateField(card, 'cardID', v)}
        loading={loadingVersions.has(card.cardID)}
        onPointerDown={() => handleVersionDropdownFocus(card)}
        options={Object.entries(
          versionDict[normalizeName(cardName(card))]
            ? Object.fromEntries(versionDict[normalizeName(cardName(card))].map((v) => [v.scryfall_id, v]))
            : defaultVersions(card),
        ).map(([key, value]) => ({
          value: key,
          label: value.version,
        }))}
      />
    ),
    type: (card) => (
      <Input
        type="text"
        name="type_line"
        value={cardType(card)}
        onChange={(event) => updateField(card, 'type_line', event.target.value)}
      />
    ),
    status: (card) => (
      <Select
        value={card.status}
        setValue={(v) => updateField(card, 'status', v)}
        options={getLabels(null, 'Status').map((status) => ({
          value: status,
          label: status,
        }))}
      />
    ),
    finish: (card) => (
      <Select
        value={card.finish}
        setValue={(v) => updateField(card, 'finish', v)}
        options={getLabels(null, 'Finish').map((finish) => ({
          value: finish,
          label: finish,
        }))}
      />
    ),
    cmc: (card) => (
      <Input
        type="text"
        name="cmc"
        value={`${card.cmc ?? card.details?.cmc ?? ''}`}
        onChange={(e) => onCmcChange(card, e)}
        valid={isCardCmcValid(card.cmc ?? card.details?.cmc).valid ? undefined : false}
        placeholder={`${card.details?.cmc ?? ''}`}
        otherInputProps={{
          required: true,
          pattern: '[0-9.]+',
        }}
        style={{ maxWidth: '3rem' }}
      />
    ),
    colorIdentity: (card) => (
      <Select
        value={cardColorIdentity(card).join('')}
        setValue={(v) => updateField(card, 'colors', v)}
        options={colorCombos.map((combo) => ({
          value: combo,
          label: combo,
        }))}
      />
    ),
    colorCategory: (card) => (
      <Select
        value={cardColorCategory(card)}
        setValue={(v) => updateField(card, 'colorCategory', v)}
        options={getLabels(null, 'Color Category').map((category) => ({
          value: category,
          label: category,
        }))}
      />
    ),
    rarity: (card) => {
      const currentRarity = cardRarity(card).toLowerCase();
      // Include the card's actual rarity as an option if it isn't one of the known
      // Scryfall rarities (or is missing), so the Select shows the real value rather
      // than silently defaulting to the first option and overwriting it on interaction.
      const rarities = RARITY_OPTIONS.includes(currentRarity) ? RARITY_OPTIONS : [currentRarity, ...RARITY_OPTIONS];
      return (
        <Select
          value={currentRarity}
          setValue={(v) => updateField(card, 'rarity', v)}
          options={rarities.map((rarity) => ({
            value: rarity,
            label: rarity ? `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}` : '(none)',
          }))}
        />
      );
    },
    notes: (card) => (
      <Input
        type="text"
        name="notes"
        value={cardNotes(card)}
        onChange={(event) => updateField(card, 'notes', event.target.value)}
      />
    ),
    tags: (card) => (
      <TagInput
        tags={cardTags(card).map((tag) => ({ text: tag, id: tag }))}
        addTag={(tag: TagData) => {
          const existingTags = cardTags(card);
          if (!existingTags.includes(tag.text)) {
            updateField(card, 'tags', [...cardTags(card), tag.text]);
          }
        }}
        deleteTag={(index: number) => {
          const newTags = [...cardTags(card)];
          newTags.splice(index, 1);
          updateField(card, 'tags', newTags);
        }}
        tagColors={tagColors}
        suggestions={allTags}
      />
    ),
  };

  const orderedVisibleColumns = TOGGLEABLE_COLUMNS.filter((column) => visibleColumns.includes(column.key));
  const headers = ['Name', ...orderedVisibleColumns.map((column) => column.label)];
  const rows = sorted.map((card) => {
    const row: { [key: string]: React.ReactNode } = {
      Name: (
        <Flexbox direction="row" gap="2">
          <Checkbox label="" checked={checked[cardIndex(card)]} setChecked={() => handleCheck(card)} />
          <CardModalLink
            card={card}
            modalprops={{ card: { board: card.board || 'mainboard', index: cardIndex(card) } }}
          >
            {cardName(card)}
          </CardModalLink>
        </Flexbox>
      ),
    };
    for (const column of orderedVisibleColumns) {
      row[column.label] = columnRenderers[column.key](card);
    }
    return row;
  });

  return (
    <Card className="my-3">
      <PagedTable
        pageSize={pageSize}
        headers={headers}
        rows={rows}
        paginateClassname="p-2"
        rightControl={
          <Button
            color="secondary"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1 whitespace-nowrap"
          >
            <GearIcon size={16} />
            <span>Columns</span>
          </Button>
        }
        sideControl={
          <Flexbox direction="row" justify="between" gap="2" alignItems="end">
            {canEdit && (
              <>
                <Button color="primary" onClick={handleCheckAll}>
                  Check All
                </Button>
                <Button
                  color="danger"
                  onClick={() => setChecked({})}
                  disabled={Object.values(checked).every((c) => !c)}
                >
                  Uncheck All
                </Button>
                <GroupModalButton
                  color="accent"
                  disabled={Object.values(checked).every((c) => !c)}
                  modalprops={{ cards: cards.filter((card) => checked[cardIndex(card)]) }}
                >
                  Edit Selected
                </GroupModalButton>
                {Object.values(checked).some((c) => c) && (
                  <Flexbox direction="row" alignItems="center">
                    <Text semibold text-md>
                      {Object.values(checked).filter((c) => c).length} Cards Selected
                    </Text>
                  </Flexbox>
                )}
              </>
            )}
          </Flexbox>
        }
      />
      <ListViewSettingsModal
        isOpen={settingsOpen}
        setOpen={setSettingsOpen}
        pageSize={pageSize}
        setPageSize={setPageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        columns={TOGGLEABLE_COLUMNS}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      />
    </Card>
  );
};

export default ListView;
