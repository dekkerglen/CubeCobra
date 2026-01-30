import React, { useContext } from 'react';

import { GraphIcon, PlusIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

const RecordsNavbar: React.FC = () => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!isOwner) {
    return null;
  }

  return (
    <Flexbox direction="row" gap="6" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <Link
        href={`/cube/records/create/${getCubeId(cube)}`}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        <PlusIcon size={16} />
        Create New Record
      </Link>
      <Link
        href={`/cube/records/create/fromDraft/${getCubeId(cube)}`}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        <PlusIcon size={16} />
        Create from Draft
      </Link>
      <Link
        href={`/cube/records/analytics/${getCubeId(cube)}`}
        className="flex items-center gap-2 !text-button-primary hover:!text-button-primary-active transition-colors font-medium cursor-pointer"
      >
        <GraphIcon size={16} />
        Compile Analytics
      </Link>
    </Flexbox>
  );
};

export default RecordsNavbar;
