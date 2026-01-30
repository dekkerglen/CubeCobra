import React, { useContext } from 'react';

import { PlusIcon, ToolsIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import CreateBlogModal from 'components/modals/CreateBlogModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const CreateBlogModalButton = withModal('a', CreateBlogModal);

const BlogNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2">
      <Dropdown
        trigger={
          <Button color="secondary" className="flex items-center gap-2 py-2">
            <ToolsIcon size={16} />
          </Button>
        }
        align="left"
        minWidth="16rem"
      >
        <Flexbox direction="col" gap="2" className="p-3">
          <CreateBlogModalButton
            modalprops={{ cubeID: cube.id, post: null }}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium flex items-center justify-between"
          >
            <span>Create New Blogpost</span>
            <PlusIcon size={16} />
          </CreateBlogModalButton>
        </Flexbox>
      </Dropdown>
    </Flexbox>
  );
};

export default BlogNavbar;
