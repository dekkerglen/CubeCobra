import { ChevronUpIcon, QuestionIcon, ThreeBarsIcon } from '@primer/octicons-react';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
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
import Select from '../base/Select';
import NavMenu from '../base/NavMenu';
import Checkbox from '../base/Checkbox';
import Tooltip from '../base/Tooltip';
import TagColorsModal from '../modals/TagColorsModal';

const PasteBulkModalItem = withModal(Link, PasteBulkModal);
const UploadBulkModalItem = withModal(Link, UploadBulkModal);
const UploadBulkReplaceModalItem = withModal(Link, UploadBulkReplaceModal);
const TagColorsModalItem = withModal(Link, TagColorsModal);

interface CubeListNavbarProps {
  cubeView: string;
  setCubeView: (view: string) => void;
}

const CubeListNavbar: React.FC<CubeListNavbarProps> = ({ cubeView, setCubeView }) => {
  const [expanded, toggleExpanded] = useToggle(false);
  const [isSortUsed, setIsSortUsed] = useState(true);
  const [isFilterUsed, setIsFilterUsed] = useState(true);

  const { canEdit, hasCustomImages, cube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary, setShowUnsorted } =
    useContext(CubeContext);
  const { filterInput } = useContext(FilterContext);

  const {
    showCustomImages,
    toggleShowCustomImages,
    compressedView,
    toggleCompressedView,
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

  const enc = encodeURIComponent;
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
          <Link onClick={toggleCompressedView}>
            {compressedView ? 'Disable Compressed View' : 'Enable Compressed View'}
          </Link>
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
              <Link disabled>Import</Link>
              <PasteBulkModalItem>Paste Text</PasteBulkModalItem>
              <UploadBulkModalItem>Upload File</UploadBulkModalItem>
              <UploadBulkReplaceModalItem>Replace with CSV File Upload</UploadBulkReplaceModalItem>
              <br />
              <Link disabled>Export</Link>
            </>
          )}
          <Link href={`/cube/download/plaintext/${cube.id}?${urlSegment}`}>Card Names (.txt)</Link>
          <Link href={`/cube/download/csv/${cube.id}?${urlSegment}`}>Comma-Separated (.csv)</Link>
          <Link href={`/cube/download/forge/${cube.id}?${urlSegment}`}>Forge (.dck)</Link>
          <Link href={`/cube/download/mtgo/${cube.id}?${urlSegment}`}>MTGO (.txt)</Link>
          <Link href={`/cube/download/xmage/${cube.id}?${urlSegment}`}>XMage (.dck)</Link>
          <br />
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

  return (
    <Controls>
      <Flexbox direction="col" className="py-2 px-4">
        <Flexbox direction="row" wrap="wrap" justify="between" alignItems="center">
          <Flexbox direction="row" justify="start" gap="4" alignItems="center">
            <Select
              options={[
                { value: 'table', label: 'Table View' },
                { value: 'spoiler', label: 'Visual Spoiler' },
                { value: 'list', label: 'List View' },
                { value: 'curve', label: 'Curve View' },
              ]}
              value={cubeView}
              setValue={setCubeView}
            />
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
          <SortCollapse isOpen={openCollapse === 'sort'} />
          <FilterCollapse isOpen={openCollapse === 'filter'} />
          <CompareCollapse isOpen={openCollapse === 'compare'} />
        </div>
      </Flexbox>
    </Controls>
  );
};

export default CubeListNavbar;
