import React, { useContext } from 'react';

import { ChecklistIcon, ChevronDownIcon, FileIcon, PlayIcon, PlusIcon, UploadIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import CreateRecordFromDraftModal from 'components/modals/CreateRecordFromDraftModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

const navItemClass =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

// Everything inside the menu builds a record from something that already exists. They are
// each rarer than the two ways to start one from nothing, and three of them in the same row
// made six undifferentiated links out of what is really two choices and a menu.
const menuItemClass = 'flex items-center gap-2 !text-link hover:!text-link-active font-medium cursor-pointer';

const FromDraftLink = withModal(Link, CreateRecordFromDraftModal);

// Both creation paths link to the wizard rather than posting anything. The wizard's own form
// creates the record on submit, so opening either and abandoning it leaves no orphaned record
// behind — unlike a click-time POST, which created one the moment the button was pressed.
const StartEventLink: React.FC<{ cubeId: string }> = ({ cubeId }) => (
  <Link href={`/cube/records/create/${cubeId}`} className={navItemClass}>
    <PlayIcon size={16} />
    <ResponsiveDiv baseVisible md>
      Start Event
    </ResponsiveDiv>
    <ResponsiveDiv md>Start an Event</ResponsiveDiv>
  </Link>
);

const InputFinishedEventLink: React.FC<{ cubeId: string }> = ({ cubeId }) => (
  <Link href={`/cube/records/create/finished/${cubeId}`} className={navItemClass}>
    <ChecklistIcon size={16} />
    <ResponsiveDiv baseVisible md>
      Input Event
    </ResponsiveDiv>
    <ResponsiveDiv md>Input Finished Event</ResponsiveDiv>
  </Link>
);

const RecordsNavbar: React.FC = () => {
  const { cube, canEdit } = useContext(CubeContext);

  if (!cube) {
    return null;
  }

  // Exporting moved into the Draft Reports card's own header: it acts on the list, not on
  // this row of ways to add to it. Nothing else here is open to a reader, so for one there is
  // no row to show.
  if (!canEdit) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <StartEventLink cubeId={getCubeId(cube)} />
      <InputFinishedEventLink cubeId={getCubeId(cube)} />
      <Dropdown
        align="left"
        minWidth="16rem"
        trigger={
          <Link className={navItemClass}>
            <PlusIcon size={16} />
            <ResponsiveDiv baseVisible md>
              Existing
            </ResponsiveDiv>
            <ResponsiveDiv md>From an existing event</ResponsiveDiv>
            <ChevronDownIcon size={16} />
          </Link>
        }
      >
        <Flexbox direction="col" gap="3" className="p-3">
          <FromDraftLink className={menuItemClass} modalprops={{ cube }}>
            <PlayIcon size={16} />
            Create from Draft
          </FromDraftLink>
          <Link href={`/cube/records/hedron/${getCubeId(cube)}`} className={menuItemClass}>
            <UploadIcon size={16} />
            Import from Hedron Network
          </Link>
          <Link href={`/cube/records/importfile/${getCubeId(cube)}`} className={menuItemClass}>
            {/* Its own icon: sharing UploadIcon with Hedron made the two indistinguishable at
                the glance an icon exists for. */}
            <FileIcon size={16} />
            Import from File
          </Link>
        </Flexbox>
      </Dropdown>
    </Flexbox>
  );
};

export default RecordsNavbar;
