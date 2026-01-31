import React, { useContext } from 'react';

import { GraphIcon, PlusIcon } from '@primer/octicons-react';
import { getCubeId } from '@utils/Util';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
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
    <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
      <Link
        href={`/cube/records/create/${getCubeId(cube)}`}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <PlusIcon size={16} />
        <ResponsiveDiv baseVisible md>
          New Record
        </ResponsiveDiv>
        <ResponsiveDiv md>Create New Record</ResponsiveDiv>
      </Link>
      <Link
        href={`/cube/records/create/fromDraft/${getCubeId(cube)}`}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <PlusIcon size={16} />
        <ResponsiveDiv baseVisible md>
          From Draft
        </ResponsiveDiv>
        <ResponsiveDiv md>Create from Draft</ResponsiveDiv>
      </Link>
      <Link
        href={`/cube/records/analytics/${getCubeId(cube)}`}
        className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
      >
        <GraphIcon size={16} />
        <ResponsiveDiv baseVisible md>
          Recompile
        </ResponsiveDiv>
        <ResponsiveDiv md>Compile Analytics</ResponsiveDiv>
      </Link>
    </Flexbox>
  );
};

export default RecordsNavbar;
