import React, { useContext } from 'react';

import CardType from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import { getLabels, sortDeep, sortIntoGroups } from '@utils/sorting/Sort';
import classNames from 'classnames';

import { ListGroup, ListGroupItem } from 'components/base/ListGroup';
import Text from 'components/base/Text';
import AutocardListItem from 'components/card/AutocardListItem';
import AddToCubeModal from 'components/modals/AddToCubeModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';

import { COMPARE_SETS, CompareSet, CompareSides, SetChips } from './CompareArt';

const AutocardListItemLink = withModal(AutocardListItem, AddToCubeModal);

type SetCards = Record<CompareSet, CardType[]>;

/**
 * Splits cards by the set their index is in. A card is placed the first time it is seen, and
 * `claimed` carries across calls, so a card that sorts into several groups shows up once.
 */
const splitBySet = (cards: CardType[], sets: Record<CompareSet, Set<number>>, claimed: Set<number>): SetCards => {
  const result: SetCards = { onlyA: [], both: [], onlyB: [] };
  for (const card of cards) {
    const index = card.index ?? -1;
    const set = claimed.has(index) ? undefined : COMPARE_SETS.find((key) => sets[key].has(index));
    if (set) {
      claimed.add(index);
      result[set].push(card);
    }
  }
  return result;
};

interface SetCountsProps {
  counts: SetCards;
  sets: CompareSet[];
  sides: CompareSides;
}

const SetCounts: React.FC<SetCountsProps> = ({ counts, sets, sides }) => (
  <span className="flex items-center gap-3">
    {sets.map((set) => (
      <span key={set} className="inline-flex items-center gap-1" title={sides.captions[set]}>
        <SetChips set={set} sides={sides} />
        <Text sm semibold>
          {counts[set].length}
        </Text>
      </span>
    ))}
  </span>
);

interface SortProps {
  sortTertiary: string;
  sortQuaternary: string;
  showUnsorted: boolean;
  cube?: Cube | null;
}

interface CompareGroupProps extends SortProps {
  heading: string;
  cards: SetCards;
}

/** One secondary group (e.g. Creature) with each set in its own column, rows split by the tertiary sort. */
const CompareGroup: React.FC<CompareGroupProps> = ({
  heading,
  cards,
  sortTertiary,
  sortQuaternary,
  showUnsorted,
  cube,
}) => {
  // Group by the tertiary sort and order each group by the quaternary (ordered) sort,
  // mirroring how the standard table/list views apply all four sorts.
  const toGroups = (list: CardType[]): Record<string, CardType[]> =>
    Object.fromEntries(sortDeep(list, showUnsorted, sortQuaternary, [sortTertiary], cube) as [string, CardType[]][]);
  const grouped = Object.fromEntries(COMPARE_SETS.map((set) => [set, toGroups(cards[set])])) as Record<
    CompareSet,
    Record<string, CardType[]>
  >;
  const shown = COMPARE_SETS.flatMap((set) => cards[set]);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border-secondary">
      <div className="bg-bg-active px-2 py-1">
        <Text sm semibold className="block text-center">
          {heading}
        </Text>
        <div className="grid grid-cols-3">
          {COMPARE_SETS.map((set) => (
            <Text key={set} xs className="text-center text-text-secondary">
              {cards[set].length}
            </Text>
          ))}
        </div>
      </div>
      {getLabels(shown, sortTertiary, showUnsorted, cube)
        .filter((label) => COMPARE_SETS.some((set) => grouped[set][label]))
        .map((label) => (
          <div
            key={label}
            className="grid grid-cols-3 divide-x divide-border-secondary border-t border-border-secondary"
          >
            {COMPARE_SETS.map((set) => (
              <div key={set} className="min-w-0">
                {(grouped[set][label] || []).map((card) => (
                  <AutocardListItemLink key={card.index} card={card} modalprops={{ card }} />
                ))}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};

interface SetListProps extends SortProps {
  heading: string;
  cards: CardType[];
}

/** One set's cards in a secondary group, as a single list split by the tertiary sort, like the cube's table view. */
const SetList: React.FC<SetListProps> = ({ heading, cards, sortTertiary, sortQuaternary, showUnsorted, cube }) => {
  const groups = sortDeep(cards, showUnsorted, sortQuaternary, [sortTertiary], cube) as [string, CardType[]][];
  return (
    <ListGroup>
      <ListGroupItem heading>{`${heading} (${cards.length})`}</ListGroupItem>
      {groups.map(([label, group], groupIndex) =>
        group.map((card, index) => (
          <AutocardListItemLink
            key={`${label}-${card.index}`}
            card={card}
            className={index === 0 && groupIndex > 0 ? 'border-t border-border-secondary' : undefined}
            modalprops={{ card }}
          />
        )),
      )}
    </ListGroup>
  );
};

interface Section {
  label: string;
  counts: SetCards;
  groups: { label: string; cards: SetCards }[];
}

export interface CompareViewProps {
  cards: CardType[];
  // These fields all take indices into the cards array.
  both: number[];
  onlyA: number[];
  onlyB: number[];
  sides: CompareSides;
  /** Show only this set, laid out like the cube's table view, or all three side by side. */
  focus: CompareSet | null;
}

const CompareView: React.FC<CompareViewProps> = ({ cards, both, onlyA, onlyB, sides, focus }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube } = useContext(CubeContext) ?? {};
  const { showUnsorted } = useContext(DisplayContext).displayOptions;
  const sortProps: SortProps = {
    sortTertiary: sortTertiary ?? 'Mana Value',
    sortQuaternary: sortQuaternary ?? 'Alphabetical',
    showUnsorted,
    cube,
  };

  const indexSets: Record<CompareSet, Set<number>> = {
    onlyA: new Set(onlyA),
    both: new Set(both),
    onlyB: new Set(onlyB),
  };
  const sets = focus ? [focus] : COMPARE_SETS;

  const columnsPrimary = sortIntoGroups(cards, sortPrimary ?? 'Unsorted', showUnsorted, cube);
  // Counts and groups each place a card once, in the first column (and group) it sorts into.
  const countClaimed = new Set<number>();
  const groupClaimed = new Set<number>();
  const sections: Section[] = getLabels(cards, sortPrimary ?? 'Unsorted', showUnsorted, cube)
    .filter((columnLabel) => columnsPrimary[columnLabel])
    .map((columnLabel) => {
      const counts = splitBySet(columnsPrimary[columnLabel], indexSets, countClaimed);
      const column = sortIntoGroups(columnsPrimary[columnLabel], sortSecondary ?? 'Unsorted', showUnsorted, cube);
      const groups = getLabels(Object.values(column).flat(), sortSecondary ?? 'Unsorted', showUnsorted, cube)
        .filter((label) => column[label])
        .map((label) => ({ label, cards: splitBySet(column[label], indexSets, groupClaimed) }));
      return { label: columnLabel, counts, groups };
    })
    .filter((section) => sets.some((set) => section.counts[set].length > 0));

  return (
    <div className="my-3 flex flex-col gap-5">
      {/* Which column is which, pinned while the lists scroll past. */}
      <div
        className={classNames(
          'sticky top-0 z-20 grid gap-2 rounded-md border border-border bg-bg-accent/95 px-2 py-1.5 shadow-sm backdrop-blur',
          focus ? 'grid-cols-1' : 'grid-cols-3',
        )}
      >
        {sets.map((set) => (
          <div key={set} className="flex min-w-0 items-center justify-center gap-2">
            <SetChips set={set} sides={sides} className="ring-bg-accent" />
            <Text sm semibold className="truncate">
              {sides.captions[set]}
            </Text>
          </div>
        ))}
      </div>
      {focus ? (
        <div className="flex flex-wrap justify-center gap-2">
          {sections.map((section) => (
            <div key={section.label} className="flex min-w-0 max-w-[16rem] flex-[1_1_10rem] flex-col gap-2">
              <Text md semibold className="block text-center">
                {section.label} <span className="text-text-secondary">({section.counts[focus].length})</span>
              </Text>
              {section.groups
                .filter((group) => group.cards[focus].length > 0)
                .map((group) => (
                  <SetList key={group.label} heading={group.label} cards={group.cards[focus]} {...sortProps} />
                ))}
            </div>
          ))}
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.label} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-1">
              <Text lg semibold>
                {section.label}
              </Text>
              <SetCounts counts={section.counts} sets={sets} sides={sides} />
            </div>
            {section.groups.map((group) => (
              <CompareGroup key={group.label} heading={group.label} cards={group.cards} {...sortProps} />
            ))}
          </section>
        ))
      )}
    </div>
  );
};

export default CompareView;
