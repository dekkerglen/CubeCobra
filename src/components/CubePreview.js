import React, { useCallback, useState } from 'react';
import { Card } from 'reactstrap';

import CubePropType from 'proptypes/CubePropType';

import AspectRatioBox from 'components/AspectRatioBox';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';
import { getCubeDescription, getCubeId } from 'utils/Util';

const CubePreview = ({ cube }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        <MtgImage image={cube.image} showArtist />
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <a href={`/cube/overview/${encodeURIComponent(getCubeId(cube))}`} className="stretched-link">
          <h5 className="text-muted text-ellipsis my-0" title={cube.name}>
            {cube.name}
          </h5>
        </a>
        <div className="text-muted text-ellipsis">{getCubeDescription(cube)}</div>
        <div className="text-muted text-ellipsis">{cube.following.length} followers</div>
        <em className="text-muted text-ellipsis">
          Designed by <Username user={cube.owner} />
        </em>
      </div>
    </Card>
  );
};

CubePreview.propTypes = {
  cube: CubePropType.isRequired,
};

export default CubePreview;
