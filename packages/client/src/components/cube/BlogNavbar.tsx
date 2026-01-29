import React, { useContext } from 'react';

import { PlusIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import CreateBlogModal from 'components/modals/CreateBlogModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const CreateBlogModalButton = withModal(Button, CreateBlogModal);

const BlogNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="mt-2 mb-2" wrap="wrap">
      <div className="px-2">
        <CreateBlogModalButton
          modalprops={{ cubeID: cube.id, post: null }}
          color="secondary"
          className="flex items-center gap-2"
        >
          Create New Blogpost
          <PlusIcon size={16} />
        </CreateBlogModalButton>
      </div>
    </Flexbox>
  );
};

export default BlogNavbar;
