import Button from 'components/base/Button';
import { Card } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import withCardModal from 'components/modals/WithCardModal';
import withGroupModal from 'components/modals/WithGroupModal';
import PagedTable from 'components/PagedTable';
import TagInput from 'components/TagInput';
import withAutocard from 'components/WithAutocard';
import CubeContext from 'contexts/CubeContext';
import CardType from 'datatypes/Card';
import TagData from 'datatypes/TagData';
import React, { useCallback, useContext, useState } from 'react';
import {
  cardCmc,
  cardColorIdentity,
  cardFullName,
  cardIndex,
  cardName,
  cardTags,
  cardType,
  normalizeName,
} from 'utils/Card';
import { getLabels } from 'utils/Sort';

const GroupModalButton = withGroupModal(Button);

const AutoCardLink = withAutocard(Link);
const CardModalLink = withCardModal(AutoCardLink);

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
  const { versionDict, editCard, tagColors, allTags, canEdit } = useContext(CubeContext);
  const [checked, setChecked] = useState<{ [key: string]: boolean }>({});
  const [pageSize, setPageSize] = useState(50);

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

  const headers = ['Name', 'Version', 'Type', 'Status', 'Finish', 'CMC', 'Color Identity', 'Tags'];
  const rows = cards.map((card) => ({
    Name: (
      <Flexbox direction="row" gap="2">
        <Checkbox label="" checked={checked[cardIndex(card)]} setChecked={() => handleCheck(card)} />
        <CardModalLink card={card} modalprops={{ card: { board: card.board || 'mainboard', index: cardIndex(card) } }}>
          {cardName(card)}
        </CardModalLink>
      </Flexbox>
    ),
    Version: (
      <Select
        value={card.cardID}
        setValue={(v) => updateField(card, 'cardID', v)}
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
    Type: (
      <Input
        type="text"
        name="type_line"
        value={cardType(card)}
        onChange={(event) => updateField(card, 'type_line', event.target.value)}
      />
    ),
    Status: (
      <Select
        value={card.status}
        setValue={(v) => updateField(card, 'status', v)}
        options={getLabels(null, 'Status').map((status) => ({
          value: status,
          label: status,
        }))}
      />
    ),
    Finish: (
      <Select
        value={card.finish}
        setValue={(v) => updateField(card, 'finish', v)}
        options={getLabels(null, 'Finish').map((finish) => ({
          value: finish,
          label: finish,
        }))}
      />
    ),
    CMC: (
      <Input
        type="text"
        name="cmc"
        value={`${cardCmc(card)}`}
        onChange={(event) => updateField(card, 'cmc', event.target.value)}
        style={{ maxWidth: '3rem' }}
      />
    ),
    'Color Identity': (
      <Select
        value={cardColorIdentity(card).join('')}
        setValue={(v) => updateField(card, 'colors', v)}
        options={colorCombos.map((combo) => ({
          value: combo,
          label: combo,
        }))}
      />
    ),
    Tags: (
      <TagInput
        tags={cardTags(card).map((tag) => ({ text: tag, id: tag }))}
        addTag={(tag: TagData) => {
          updateField(card, 'tags', [...cardTags(card), tag.text]);
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
  }));

  return (
    <Card className="my-3">
      <PagedTable
        pageSize={pageSize}
        headers={headers}
        rows={rows}
        paginateClassname="p-2"
        sideControl={
          <Flexbox direction="row" justify="between" gap="2" alignItems="end">
            <Select
              label="Page Size"
              value={`${pageSize}`}
              setValue={(v) => setPageSize(parseInt(v, 10))}
              options={[10, 25, 50, 100].map((size) => ({
                value: `${size}`,
                label: `${size}`,
              }))}
              dense
            />
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
    </Card>
  );
};

export default ListView;
