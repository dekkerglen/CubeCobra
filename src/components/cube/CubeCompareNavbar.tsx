import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import FilterCollapse from 'components/FilterCollapse';
import TagColorsModal from 'components/modals/TagColorsModal';
import SortCollapse from 'components/SortCollapse';
import React, { useCallback } from 'react';

import { ChevronUpIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Cube from 'datatypes/Cube';
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
}

const CubeCompareNavbar: React.FC<CubeCompareNavbarProps> = ({
  cubeA,
  cubeAID,
  cubeB,
  cubeBID,
  openCollapse,
  setOpenCollapse,
}) => {
  const [expanded, toggleExpanded] = useToggle(false);
  const handleOpenCollapse = useCallback(
    (tab: string) => {
      setOpenCollapse((openCollapseArg) => (openCollapseArg === tab ? null : tab));
    },
    [setOpenCollapse],
  );

  const controls = (
    <>
      <Link onClick={() => handleOpenCollapse('sort')}>Sort</Link>
      <Link onClick={() => handleOpenCollapse('filter')}>Filter</Link>
      <TagColorsModalItem>View Tag Colors</TagColorsModalItem>
    </>
  );

  return (
    <Controls>
      <Flexbox direction="col" gap="2" className="py-2 px-4">
        <div className="cubenav">
          <ul className="nav nav-tabs nav-fill pt-2">
            <li className="nav-item">
              <Text semibold md>
                Compare cubes
              </Text>
              <Text semibold md>
                <span className="text-muted">Base Cube:</span>{' '}
                <a href={`/cube/list/${cubeAID}`} className="me-3" style={{ color: '#218937' }}>
                  {cubeA.name} ({cubeA.cardCount} cards)
                </a>{' '}
                <span className="text-muted">Comparison Cube:</span>{' '}
                <a href={`/cube/list/${cubeBID}`} style={{ color: '#218937' }}>
                  {cubeB.name} ({cubeB.cardCount} cards)
                </a>
              </Text>
            </li>
          </ul>
        </div>
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
          <FilterCollapse isOpen={openCollapse === 'filter'} />
        </div>
      </Flexbox>
    </Controls>
  );
};

export default CubeCompareNavbar;
