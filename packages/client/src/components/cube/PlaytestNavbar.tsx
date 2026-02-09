import React, { useContext } from 'react';

import { PlusIcon, ToolsIcon, UploadIcon } from '@primer/octicons-react';

import { Flexbox } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import CustomDraftFormatModal from 'components/modals/CustomDraftFormatModal';
import CustomizeBasicsModal from 'components/modals/CustomizeBasicsModal';
import UploadDecklistModal from 'components/modals/UploadDecklistModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import useAlerts from 'hooks/UseAlerts';

const UploadDecklistModalButton = withModal('a', UploadDecklistModal);
const CreateCustomFormatButton = withModal('a', CustomDraftFormatModal);
const CustomizeBasicsModalButton = withModal('a', CustomizeBasicsModal);

const PlaytestNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);
  const { addAlert } = useAlerts();

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <CreateCustomFormatButton
        modalprops={{
          formatIndex: -1,
        }}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <PlusIcon size={16} />
        <ResponsiveDiv baseVisible md>
          Custom Draft
        </ResponsiveDiv>
        <ResponsiveDiv md>Create Custom Draft Format</ResponsiveDiv>
      </CreateCustomFormatButton>
      <UploadDecklistModalButton className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2">
        <UploadIcon size={16} />
        <ResponsiveDiv baseVisible md>
          Upload
        </ResponsiveDiv>
        <ResponsiveDiv md>Upload Decklist</ResponsiveDiv>
      </UploadDecklistModalButton>
      <CustomizeBasicsModalButton
        modalprops={{
          cube: cube,
          onError: (message: string) => {
            addAlert('danger', message);
          },
        }}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <ToolsIcon size={16} />
        <ResponsiveDiv baseVisible md>
          Basics
        </ResponsiveDiv>
        <ResponsiveDiv md>Customize Basics</ResponsiveDiv>
      </CustomizeBasicsModalButton>
    </Flexbox>
  );
};

export default PlaytestNavbar;
