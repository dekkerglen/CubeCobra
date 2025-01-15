import React from 'react';

import { getCubeDescription, getCubeId } from 'utils/Util';

import Cube from '../../../datatypes/Cube';
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
        <div className="overflow-hidden flex">
          <img src={cube.image.uri} alt={cube.name} className="max-w-full self-center" />
        </div>
      </Flexbox>
    </Tile>
  );
};

export default CubePreview;
