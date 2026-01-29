import React, { useContext } from 'react';

import { GraphIcon, PlusIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
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
    <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="mt-2 mb-2" wrap="wrap">
      <div className="px-2">
        <Button
          type="link"
          href={`/cube/records/create/${getCubeId(cube)}`}
          color="secondary"
          className="flex items-center gap-2"
        >
          Create New Record
          <PlusIcon size={16} />
        </Button>
      </div>
      <div className="px-2">
        <Button
          type="link"
          href={`/cube/records/create/fromDraft/${getCubeId(cube)}`}
          color="secondary"
          className="flex items-center gap-2"
        >
          Create from Draft
          <PlusIcon size={16} />
        </Button>
      </div>
      <div className="px-2">
        <Button
          type="link"
          href={`/cube/records/analytics/${getCubeId(cube)}`}
          color="secondary"
          className="flex items-center gap-2"
        >
          Compile Analytics
          <GraphIcon size={16} />
        </Button>
      </div>
    </Flexbox>
  );
};

export default RecordsNavbar;
