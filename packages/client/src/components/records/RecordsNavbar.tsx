import React, { useContext, useRef } from 'react';

import { DownloadIcon, PlusIcon, UploadIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import CSRFForm from 'components/CSRFForm';
import CreateRecordFromDraftModal from 'components/modals/CreateRecordFromDraftModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';

import { defaultRecordName } from '../../records/recordName';

const navItemClass =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

const FromDraftLink = withModal(Link, CreateRecordFromDraftModal);

// One click: POST a record with today's date + a default name, server redirects
// straight to the new record.
const CreateNewRecordButton: React.FC<{ cubeId: string }> = ({ cubeId }) => {
  const formRef = useRef<HTMLFormElement>(null);

  // Build the record when the button is pressed rather than during render. `new Date()` in
  // render is impure, and the previous version baked the render-time date into a hidden input,
  // so a page left open overnight would have created a record dated the day before.
  const handleClick = () => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const now = new Date();
    const recordInput = form.elements.namedItem('record') as HTMLInputElement | null;
    if (recordInput) {
      recordInput.value = JSON.stringify({ name: defaultRecordName(now), date: now.valueOf() });
    }

    form.submit();
  };

  return (
    <>
      <button type="button" className={navItemClass} onClick={handleClick}>
        <PlusIcon size={16} />
        <ResponsiveDiv baseVisible md>
          New Record
        </ResponsiveDiv>
        <ResponsiveDiv md>Create New Record</ResponsiveDiv>
      </button>
      <div className="hidden">
        <CSRFForm method="POST" action={`/cube/records/create/${cubeId}`} formData={{ record: '' }} ref={formRef} />
      </div>
    </>
  );
};

const RecordsNavbar: React.FC = () => {
  const { cube, canEdit } = useContext(CubeContext);

  if (!cube) {
    return null;
  }

  // Exporting is open to anyone who can see the cube; everything else needs edit rights.
  const exportLink = (
    <a href={`/cube/records/export/${getCubeId(cube)}`} download className={navItemClass}>
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
    <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <CreateNewRecordButton cubeId={getCubeId(cube)} />
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
        <UploadIcon size={16} />
        <ResponsiveDiv baseVisible md>
          Import
        </ResponsiveDiv>
        <ResponsiveDiv md>Import from File</ResponsiveDiv>
      </Link>
      {exportLink}
    </Flexbox>
  );
};

export default RecordsNavbar;
