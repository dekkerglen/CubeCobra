import React from 'react';

import Cube from '@utils/datatypes/Cube';
import { getCubeDescription, getCubeId } from '@utils/Util';

import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Text from '../base/Text';
import { Tile } from '../base/Tile';

interface CubePreviewProps {
  cube: Cube;
}

const CubePreview: React.FC<CubePreviewProps> = ({ cube }) => {
  return (
    <Tile href={`/cube/overview/${getCubeId(cube)}`}>
      <Flexbox direction="col-reverse" className="max-h-full h-full">
        <Flexbox direction="col" className="p-1">
          <Text semibold lg className="truncate">
            {cube.name}
          </Text>
          <Text sm className="text-text-secondary truncate">
            {getCubeDescription(cube)}
          </Text>
          <Text sm className="text-text-secondary truncate">
            {cube.following.length} followers
          </Text>
          <Text sm className="truncate">
            {'Designed by '}
            <Link href={`/user/view/${cube.owner.id}`}>{cube.owner.username}</Link>
          </Text>
        </Flexbox>
        <div className="overflow-hidden flex flex-1 min-h-0">
          <img src={cube.image.uri} alt={cube.name} className="w-full h-full object-cover" />
        </div>
      </Flexbox>
    </Tile>
  );
};

export default CubePreview;
