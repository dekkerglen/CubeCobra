import React from 'react';

import { getCubeDescription, getCubeId } from 'utils/Util';
import Cube from 'datatypes/Cube';
import { Tile } from './base/Tile';
import { Flexbox } from './base/Layout';
import Text from './base/Text';

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
          <Text sm className="text-text-secondary truncate">
            Designed by {cube.owner.username}
          </Text>
        </Flexbox>
        <div className="flex-grow flex-shrink relative">
          <img src={cube.image.uri} alt={cube.name} className="object-cover w-full h-full" />
        </div>
      </Flexbox>
    </Tile>
  );
};

export default CubePreview;
