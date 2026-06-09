import React, { createRef, useContext } from 'react';

import { PlusIcon, UploadIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import CSRFForm from 'components/CSRFForm';
import CreateRecordFromDraftModal from 'components/modals/CreateRecordFromDraftModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

import { defaultRecordName } from '../../records/recordName';

const navItemClass =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

const FromDraftLink = withModal(Link, CreateRecordFromDraftModal);

// One click: POST a record with today's date + a default name, server redirects
// straight to the new record.
const CreateNewRecordButton: React.FC<{ cubeId: string }> = ({ cubeId }) => {
  const formRef = createRef<HTMLFormElement>();
  const now = new Date();
  return (
    <>
      <button type="button" className={navItemClass} onClick={() => formRef.current?.submit()}>
        <PlusIcon size={16} />
        <ResponsiveDiv baseVisible md>
          New Record
        </ResponsiveDiv>
        <ResponsiveDiv md>Create New Record</ResponsiveDiv>
      </button>
      <div className="hidden">
        <CSRFForm
          method="POST"
          action={`/cube/records/create/${cubeId}`}
          formData={{ record: JSON.stringify({ name: defaultRecordName(now), date: now.valueOf() }) }}
          ref={formRef}
        />
      </div>
    </>
  );
};

const RecordsNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
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
    </Flexbox>
  );
};

export default RecordsNavbar;
