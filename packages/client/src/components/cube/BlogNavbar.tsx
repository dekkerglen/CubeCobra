import React, { useContext } from 'react';

import { PlusIcon } from '@primer/octicons-react';

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
    <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <CreateBlogModalButton
        modalprops={{ cubeID: cube.id, post: null }}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <PlusIcon size={16} />
        Create New Blogpost
      </CreateBlogModalButton>
    </Flexbox>
  );
};

export default BlogNavbar;
