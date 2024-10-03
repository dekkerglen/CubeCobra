import React from 'react';

import AspectRatioBox from 'components/AspectRatioBox';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';
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
      <AspectRatioBox ratio={626 / 457}>
        <MtgImage image={cube.image} showArtist />
      </AspectRatioBox>
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
          Designed by <Username user={cube.owner} />
        </Text>
      </Flexbox>
    </Tile>
  );
};

export default CubePreview;
