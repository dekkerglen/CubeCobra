import React, { useCallback } from 'react';

import { ChevronUpIcon, ThreeBarsIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import FilterCollapse from 'components/FilterCollapse';
import TagColorsModal from 'components/modals/TagColorsModal';
import SortCollapse from 'components/SortCollapse';
import useToggle from 'hooks/UseToggle';

import Collapse from '../base/Collapse';
import Controls from '../base/Controls';
import Link from '../base/Link';
import ResponsiveDiv from '../base/ResponsiveDiv';
import withModal from '../WithModal';

const TagColorsModalItem = withModal(Link, TagColorsModal);

interface CubeCompareNavbarProps {
  cubeA: Cube;
  cubeAID: string;
  cubeB: Cube;
  cubeBID: string;
  openCollapse: string | null;
  setOpenCollapse: (collapse: string | ((prevCollapse: string | null) => string | null)) => void;
  cards: Card[];
  both: number[];
  onlyA: number[];
  onlyB: number[];
  pitDate?: string;
}

const CubeCompareNavbar: React.FC<CubeCompareNavbarProps> = ({
  cubeA,
  cubeAID,
  cubeB,
  cubeBID,
  openCollapse,
  setOpenCollapse,
  cards,
  both,
  onlyA,
  onlyB,
  pitDate,
}) => {
  const [expanded, toggleExpanded] = useToggle(false);
  const handleOpenCollapse = useCallback(
    (tab: string) => {
      setOpenCollapse((openCollapseArg) => (openCollapseArg === tab ? null : tab));
    },
    [setOpenCollapse],
  );

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

  const controls = (
    <>
      <Link onClick={() => handleOpenCollapse('sort')}>Sort</Link>
      <Link onClick={() => handleOpenCollapse('filter')}>Filter</Link>
      <TagColorsModalItem>View Tag Colors</TagColorsModalItem>
      <Link onClick={handleExport}>Export</Link>
    </>
  );

  return (
    <Controls>
      <Flexbox direction="col" gap="2" className="py-2 px-4">
        <Flexbox direction="col" gap="2">
          <Text semibold lg>
            Compare cubes
          </Text>
          <Flexbox direction="row" gap="2" wrap="wrap" justify="start">
            <Text semibold md className="text-muted">
              Base Cube:
            </Text>{' '}
            <Link href={`/cube/list/${cubeAID}`}>
              {cubeA.name} ({cubeA.cardCount} cards)
            </Link>{' '}
            <Text semibold md className="text-muted">
              Comparison Cube:
            </Text>{' '}
            <Link href={`/cube/list/${cubeBID}`}>
              {cubeB.name} ({cubeB.cardCount} cards)
            </Link>
          </Flexbox>
          <Text semibold sm>
            Note: Custom cards are compared based on name
          </Text>
        </Flexbox>
        <Flexbox direction="row" wrap="wrap" justify="end" alignItems="center">
          <ResponsiveDiv baseVisible lg>
            <Button color="secondary" onClick={toggleExpanded}>
              {expanded ? <ChevronUpIcon size={32} /> : <ThreeBarsIcon size={32} />}
            </Button>
          </ResponsiveDiv>
          <ResponsiveDiv lg>
            <Flexbox direction="row" justify="start" gap="4" alignItems="center">
              {controls}
            </Flexbox>
          </ResponsiveDiv>
        </Flexbox>
        <ResponsiveDiv baseVisible lg>
          <Collapse isOpen={expanded}>
            <Flexbox direction="col" gap="2" className="py-2 px-4">
              {controls}
            </Flexbox>
          </Collapse>
        </ResponsiveDiv>
        <div>
          <SortCollapse isOpen={openCollapse === 'sort'} />
          <FilterCollapse isOpen={openCollapse === 'filter'} showReset />
        </div>
      </Flexbox>
    </Controls>
  );
};

export default CubeCompareNavbar;
