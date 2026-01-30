import React, { useContext } from 'react';

import { GraphIcon, PlusIcon, ToolsIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import Button from 'components/base/Button';
import Dropdown from 'components/base/Dropdown';
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
          <Link
            href={`/cube/records/create/${getCubeId(cube)}`}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium flex items-center justify-between"
          >
            <span>Create New Record</span>
            <PlusIcon size={16} />
          </Link>
          <Link
            href={`/cube/records/create/fromDraft/${getCubeId(cube)}`}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium flex items-center justify-between"
          >
            <span>Create from Draft</span>
            <PlusIcon size={16} />
          </Link>
          <Link
            href={`/cube/records/analytics/${getCubeId(cube)}`}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium flex items-center justify-between"
          >
            <span>Compile Analytics</span>
            <GraphIcon size={16} />
          </Link>
        </Flexbox>
      </Dropdown>
    </Flexbox>
  );
};

export default RecordsNavbar;
