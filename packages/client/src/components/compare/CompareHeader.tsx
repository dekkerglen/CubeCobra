import React, { useCallback, useContext, useState } from 'react';

import { DownloadIcon, SortAscIcon, TagIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubeFilterInput from 'components/cube/CubeFilterInput';
import TagColorsModal from 'components/modals/TagColorsModal';
import SortCollapse from 'components/SortCollapse';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

import { CompareSet, CompareSides } from './CompareArt';
import CompareHero from './CompareHero';
import CompareOverlapBar from './CompareOverlapBar';

const TagColorsButton = withModal(Button, TagColorsModal);

interface CompareHeaderProps {
  sides: CompareSides;
  /** Cards the two lists share, before any filter. */
  shared: number;
  focus: CompareSet | null;
  setFocus: (focus: CompareSet | null) => void;
  cubeA: Cube;
  cubeB: Cube;
  // Cards, both/onlyA/onlyB are already filtered
  cards: Card[];
  both: number[];
  onlyA: number[];
  onlyB: number[];
  pitDate?: string;
}

const CompareHeader: React.FC<CompareHeaderProps> = ({
  sides,
  shared,
  focus,
  setFocus,
  cubeA,
  cubeB,
  cards,
  both,
  onlyA,
  onlyB,
  pitDate,
}) => {
  const [displayOpen, setDisplayOpen] = useState(false);
  const { canEdit } = useContext(CubeContext);

  const handleExport = useCallback(() => {
    const bothCards = both.map((i) => cards[i]).filter(Boolean);
    const onlyACards = onlyA.map((i) => cards[i]).filter(Boolean);
    const onlyBCards = onlyB.map((i) => cards[i]).filter(Boolean);

    const lines: string[] = [];

    const baseLabel = pitDate ? `Point in Time (${pitDate})` : cubeA.name;
    const compLabel = pitDate ? 'Present' : cubeB.name;

    lines.push(`=== In Both (${bothCards.length}) ===`);
    for (const card of bothCards) {
      lines.push(cardName(card));
    }
    lines.push('');
    lines.push(`=== Only in ${baseLabel} (${onlyACards.length}) ===`);
    for (const card of onlyACards) {
      lines.push(cardName(card));
    }
    lines.push('');
    lines.push(`=== Only in ${compLabel} (${onlyBCards.length}) ===`);
    for (const card of onlyBCards) {
      lines.push(cardName(card));
    }

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pitDate
      ? `${cubeA.name.replace(/\W/g, '')}_pit_compare.txt`
      : `${cubeA.name.replace(/\W/g, '')}_vs_${cubeB.name.replace(/\W/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cards, both, onlyA, onlyB, cubeA, cubeB, pitDate]);

  return (
    <Flexbox direction="col" gap="3" className="mt-3">
      <CompareHero sides={sides} shared={shared} />
      <CompareOverlapBar
        sides={sides}
        counts={{ onlyA: onlyA.length, both: both.length, onlyB: onlyB.length }}
        focus={focus}
        setFocus={setFocus}
      />
      <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
        <CubeFilterInput className="flex-grow" />
        <Flexbox direction="row" gap="2" alignItems="center">
          <Button
            color={displayOpen ? 'primary' : 'secondary'}
            onClick={() => setDisplayOpen(!displayOpen)}
            className="flex items-center gap-1 cursor-pointer"
          >
            <span className="hidden sm:inline">Display</span>
            <SortAscIcon size={16} />
          </Button>
          {canEdit && (
            <TagColorsButton color="secondary" className="flex items-center gap-1 cursor-pointer">
              <span className="hidden sm:inline">Tag Colors</span>
              <TagIcon size={16} />
            </TagColorsButton>
          )}
          <Button color="secondary" onClick={handleExport} className="flex items-center gap-1 cursor-pointer">
            <span className="hidden sm:inline">Export</span>
            <DownloadIcon size={16} />
          </Button>
        </Flexbox>
      </Flexbox>
      {displayOpen && (
        <div className="rounded-md border border-border bg-bg-accent px-3 pb-3">
          <SortCollapse isOpen />
        </div>
      )}
      <Text xs className="text-text-secondary">
        Note: Custom cards are compared based on name
      </Text>
    </Flexbox>
  );
};

export default CompareHeader;
