import React, { useContext } from 'react';

import { PlusIcon, UploadIcon } from '@primer/octicons-react';

import { Flexbox } from 'components/base/Layout';
import CustomDraftFormatModal from 'components/modals/CustomDraftFormatModal';
import UploadDecklistModal from 'components/modals/UploadDecklistModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const UploadDecklistModalButton = withModal('a', UploadDecklistModal);
const CreateCustomFormatButton = withModal('a', CustomDraftFormatModal);

const PlaytestNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="6" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <CreateCustomFormatButton
        modalprops={{
          formatIndex: -1,
        }}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        <PlusIcon size={16} />
        Create Custom Draft Format
      </CreateCustomFormatButton>
      <UploadDecklistModalButton className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer">
        <UploadIcon size={16} />
        Upload Decklist
      </UploadDecklistModalButton>
    </Flexbox>
  );
};

export default PlaytestNavbar;
