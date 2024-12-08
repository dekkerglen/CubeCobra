import React from 'react';

import Cube from 'datatypes/Cube';
import { getCubeDescription, getCubeId } from 'utils/Util';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { Tile } from 'components/base/Tile';

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
        <div className="overflow-hidden flex">
          <img src={cube.image.uri} alt={cube.name} className="max-w-full self-center" />
        </div>
      </Flexbox>
    </Tile>
  );
};

export default CubePreview;
