import React, { useContext } from 'react';

import { ChecklistIcon, DownloadIcon, FileIcon, PlayIcon, PlusIcon, UploadIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import CreateRecordFromDraftModal from 'components/modals/CreateRecordFromDraftModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

const navItemClass =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

// The two ways to start a record from nothing read as the page's own actions; the three ways
// to build one from something you already have are secondary, and exporting is not a way to
// add a record at all. One flat row of six said none of that.
const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ResponsiveDiv md>
    <Text xs className="text-text-secondary uppercase tracking-wide">
      {children}
    </Text>
  </ResponsiveDiv>
);

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

  // Exporting is open to anyone who can see the cube; everything else needs edit rights.
  const exportLink = (
    <a
      href={`/cube/records/export/${getCubeId(cube)}`}
      download
      className={`${navItemClass} shrink-0 text-nowrap ml-auto`}
    >
      <DownloadIcon size={16} />
      <ResponsiveDiv baseVisible md>
        Export
      </ResponsiveDiv>
      <ResponsiveDiv md>Export All Records</ResponsiveDiv>
    </a>
  );

  if (!canEdit) {
    return (
      <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
        {exportLink}
      </Flexbox>
    );
  }

  return (
    <Flexbox direction="row" gap="4" alignItems="start" justify="between" className="px-2" wrap="wrap">
      <Flexbox direction="row" gap="4" alignItems="center" wrap="wrap">
        <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
          <GroupLabel>New event</GroupLabel>
          <StartEventLink cubeId={getCubeId(cube)} />
          <InputFinishedEventLink cubeId={getCubeId(cube)} />
        </Flexbox>
        {/* A rule rather than a gap alone: the three on the right all build a record from
            something that already exists, and a gap on a wrapped row stops reading as a
            boundary the moment the row breaks. */}
        <span aria-hidden="true" className="hidden md:block h-5 w-px bg-border" />
        <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
          <GroupLabel>From existing</GroupLabel>
          <FromDraftLink className={navItemClass} modalprops={{ cube }}>
            <PlusIcon size={16} />
            <ResponsiveDiv baseVisible md>
              From Draft
            </ResponsiveDiv>
            <ResponsiveDiv md>Create from Draft</ResponsiveDiv>
          </FromDraftLink>
          <Link href={`/cube/records/hedron/${getCubeId(cube)}`} className={navItemClass}>
            <UploadIcon size={16} />
            <ResponsiveDiv baseVisible md>
              Hedron
            </ResponsiveDiv>
            <ResponsiveDiv md>Import from Hedron Network</ResponsiveDiv>
          </Link>
          <Link href={`/cube/records/importfile/${getCubeId(cube)}`} className={navItemClass}>
            {/* Its own icon: sharing UploadIcon with Hedron made the two indistinguishable at
                the glance an icon exists for. */}
            <FileIcon size={16} />
            <ResponsiveDiv baseVisible md>
              Import
            </ResponsiveDiv>
            <ResponsiveDiv md>Import from File</ResponsiveDiv>
          </Link>
        </Flexbox>
      </Flexbox>
      {/* Not a way to add a record, so not in the row of them. */}
      {exportLink}
    </Flexbox>
  );
};

export default RecordsNavbar;
