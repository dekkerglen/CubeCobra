import React, { useContext } from 'react';

import { PlusIcon, UploadIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import CustomDraftFormatModal from 'components/modals/CustomDraftFormatModal';
import UploadDecklistModal from 'components/modals/UploadDecklistModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const UploadDecklistModalButton = withModal(Button, UploadDecklistModal);
const CreateCustomFormatButton = withModal(Button, CustomDraftFormatModal);

const PlaytestNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="mt-2 mb-2" wrap="wrap">
      <div className="px-2">
        <CreateCustomFormatButton
          modalprops={{
            formatIndex: -1,
          }}
          color="secondary"
          className="flex items-center gap-2"
        >
          Create Custom Draft Format
          <PlusIcon size={16} />
        </CreateCustomFormatButton>
      </div>
      <div className="px-2">
        <UploadDecklistModalButton color="secondary" className="flex items-center gap-2">
          Upload Decklist
          <UploadIcon size={16} />
        </UploadDecklistModalButton>
      </div>
    </Flexbox>
  );
};

export default PlaytestNavbar;
