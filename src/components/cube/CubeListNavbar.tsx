import { ChevronUpIcon, QuestionIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Button from 'components/base/Button';
import { Flexbox, NumCols } from 'components/base/Layout';
import CompareCollapse from 'components/cube/CompareCollapse';
import EditCollapse from 'components/EditCollapse';
import FilterCollapse from 'components/FilterCollapse';
import PasteBulkModal from 'components/modals/PasteBulkModal';
import UploadBulkModal from 'components/modals/UploadBulkModal';
import UploadBulkReplaceModal from 'components/modals/UploadBulkReplaceModal';
import SortCollapse from 'components/SortCollapse';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';
import useToggle from 'hooks/UseToggle';
import React, { useCallback, useContext, useState } from 'react';
import Collapse from '../base/Collapse';
import Controls from '../base/Controls';
import Link from '../base/Link';
import ResponsiveDiv from '../base/ResponsiveDiv';
import Text from '../base/Text';
import Select from '../base/Select';
import NavMenu from '../base/NavMenu';
import Checkbox from '../base/Checkbox';
import Tooltip from '../base/Tooltip';
import TagColorsModal from '../modals/TagColorsModal';

const PasteBulkModalItem = withModal(Link, PasteBulkModal);
const UploadBulkModalItem = withModal(Link, UploadBulkModal);
const UploadBulkReplaceModalItem = withModal(Link, UploadBulkReplaceModal);
const TagColorsModalItem = withModal(Link, TagColorsModal);

const enc = encodeURIComponent;
interface CubeListNavbarProps {
  cubeView: string;
  setCubeView: (view: string) => void;
}

const CubeListNavbar: React.FC<CubeListNavbarProps> = ({ cubeView, setCubeView }) => {
  const [expanded, toggleExpanded] = useToggle(false);
  const [isSortUsed, setIsSortUsed] = useState(true);
  const [isFilterUsed, setIsFilterUsed] = useState(true);
  const { cardsPerRow, setCardsPerRow } = useContext(DisplayContext);

  const { canEdit, hasCustomImages, cube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, setShowUnsorted } =
    useContext(CubeContext);
  const { filterInput } = useContext(FilterContext);

  const {
    showCustomImages,
    toggleShowCustomImages,
    showMaybeboard,
    toggleShowMaybeboard,
    openCollapse,
    setOpenCollapse,
  } = useContext(DisplayContext);

  const handleOpenCollapse = useCallback(
    (tab: string) => {
      setOpenCollapse((openCollapseArg) => (openCollapseArg === tab ? null : tab));
    },
    [setOpenCollapse],
  );

  const sortUrlSegment = `primary=${enc(sortPrimary || '')}&secondary=${enc(sortSecondary || '')}&tertiary=${enc(
    sortTertiary || '',
  )}&quaternary=${enc(sortQuaternary || '')}&showother=${enc(cube.showUnsorted || false)}`;
  const filterUrlSegment = (filterInput || '').length > 0 ? `&filter=${enc(filterInput || '')}` : '';
  const urlSegment = `${isSortUsed ? sortUrlSegment : ''}${isFilterUsed ? filterUrlSegment : ''}`;

  const controls = (
    <>
      {canEdit && <Link onClick={() => handleOpenCollapse('edit')}>Edit</Link>}
      <Link onClick={() => handleOpenCollapse('sort')}>Sort</Link>
      <Link onClick={() => handleOpenCollapse('filter')}>Filter</Link>
      <Link onClick={() => handleOpenCollapse('compare')}>Compare</Link>
      <NavMenu label="Display">
        <Flexbox direction="col" gap="2" className="p-3">
          <TagColorsModalItem>{canEdit ? 'Set Tag Colors' : 'View Tag Colors'}</TagColorsModalItem>
          {hasCustomImages && (
            <Link onClick={toggleShowCustomImages}>
              {showCustomImages ? 'Hide Custom Images' : 'Show Custom Images'}
            </Link>
          )}
          <Link onClick={toggleShowMaybeboard}>{showMaybeboard ? 'Hide Maybeboard' : 'Show Maybeboard'}</Link>
          <Link onClick={() => setShowUnsorted(!cube.showUnsorted)}>
            {cube.showUnsorted ? 'Hide Unsorted cards' : 'Show Unsorted cards'}
          </Link>
        </Flexbox>
      </NavMenu>
      <NavMenu label={canEdit ? 'Import/Export' : 'Export'}>
        <Flexbox direction="col" gap="2" className="p-3">
          {canEdit && (
            <>
              <Text semibold>Import</Text>
              <PasteBulkModalItem modalprops={{ cubeID: cube.id }}>Paste Text</PasteBulkModalItem>
              <UploadBulkModalItem modalprops={{ cubeID: cube.id }}>Upload File</UploadBulkModalItem>
              <UploadBulkReplaceModalItem modalprops={{ cubeID: cube.id }}>
                Replace with CSV File Upload
              </UploadBulkReplaceModalItem>
              <Text semibold>Export</Text>
            </>
          )}
          <Link href={`/cube/download/plaintext/${cube.id}?${urlSegment}`}>Card Names (.txt)</Link>
          <Link href={`/cube/download/csv/${cube.id}?${urlSegment}`}>Comma-Separated (.csv)</Link>
          <Link href={`/cube/download/forge/${cube.id}?${urlSegment}`}>Forge (.dck)</Link>
          <Link href={`/cube/download/mtgo/${cube.id}?${urlSegment}`}>MTGO (.txt)</Link>
          <Link href={`/cube/download/xmage/${cube.id}?${urlSegment}`}>XMage (.dck)</Link>
          <Flexbox direction="row" justify="between" onClick={() => setIsSortUsed((is) => !is)}>
            <Checkbox label="Use Sort" checked={isSortUsed} setChecked={setIsSortUsed} />
            <Tooltip text="Order export using current sort options." wrapperTag="span" className="ms-auto me-0">
              <QuestionIcon size={16} />
            </Tooltip>
          </Flexbox>
          <Flexbox direction="row" justify="between" onClick={() => setIsFilterUsed((is) => !is)}>
            <Checkbox label="Use Filter" checked={isFilterUsed} setChecked={setIsFilterUsed} />
            <Tooltip
              text="Include in export only cards matching current filter."
              wrapperTag="span"
              className="ms-auto me-0"
            >
              <QuestionIcon size={16} />
            </Tooltip>
          </Flexbox>
        </Flexbox>
      </NavMenu>
    </>
  );

  const viewOptions = [
    { value: 'table', label: 'Table View' },
    { value: 'spoiler', label: 'Visual Spoiler' },
    { value: 'curve', label: 'Curve View' },
  ];

  if (canEdit) {
    viewOptions.push({ value: 'list', label: 'List View' });
  }

  return (
    <Controls>
      <Flexbox direction="col" className="py-2 px-4">
        <Flexbox direction="row" wrap="wrap" justify="between" alignItems="center">
          <Flexbox direction="row" justify="start" gap="4" alignItems="center">
            <Select options={viewOptions} value={cubeView} setValue={setCubeView} />
            {cubeView === 'spoiler' && (
              <Select
                value={`${cardsPerRow}`}
                setValue={(value) => setCardsPerRow(parseInt(value, 10) as NumCols)}
                options={[
                  {
                    value: '2',
                    label: '2 Cards Per Row',
                  },
                  {
                    value: '3',
                    label: '3 Cards Per Row',
                  },
                  {
                    value: '4',
                    label: '4 Cards Per Row',
                  },
                  {
                    value: '5',
                    label: '5 Cards Per Row',
                  },
                  {
                    value: '6',
                    label: '6 Cards Per Row',
                  },
                  {
                    value: '7',
                    label: '7 Cards Per Row',
                  },
                  {
                    value: '8',
                    label: '8 Cards Per Row',
                  },
                  {
                    value: '9',
                    label: '9 Cards Per Row',
                  },
                  {
                    value: '10',
                    label: '10 Cards Per Row',
                  },
                  {
                    value: '11',
                    label: '11 Cards Per Row',
                  },
                  {
                    value: '12',
                    label: '12 Cards Per Row',
                  },
                ]}
              />
            )}
          </Flexbox>
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
          {canEdit && <EditCollapse isOpen={openCollapse === 'edit'} />}
          <SortCollapse isOpen={openCollapse === 'sort'} canEdit={canEdit} />
          <FilterCollapse
            isOpen={openCollapse === 'filter'}
            showReset
            filterTextFn={({ mainboard, maybeboard }) =>
              mainboard && maybeboard
                ? `Showing ${mainboard[0]} / ${mainboard[1]} cards in Mainboard, ${maybeboard[0]} / ${maybeboard[1]} cards in Maybeboard.`
                : 'No cards to filter.'
            }
          />
          <CompareCollapse isOpen={openCollapse === 'compare'} />
        </div>
      </Flexbox>
    </Controls>
  );
};

export default CubeListNavbar;
