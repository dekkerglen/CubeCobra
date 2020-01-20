import React, { useCallback } from 'react';

import { Card } from 'reactstrap';

import AspectRatioBox from 'components/AspectRatioBox';

const getCubeId = (cube) => cube.urlAlias || cube.shortID || cube._id;

const CubePreview = ({ cube }) => {
  const handleClick = useCallback(() => {
    event.preventDefault();
    window.location.href = `/cube/overview/${getCubeId(cube)}`;
  }, [cube.urlAlias, cube.shortId, cube._id]);
  return (
    <Card onClick={handleClick} className="cube-preview-card">
      <AspectRatioBox ratio={626 / 457} className="text-ellipsis">
        <img className="w-100" src={cube.image_uri} />
        <em className="cube-preview-artist">Art by {cube.image_artist}</em>
      </AspectRatioBox>
      <div className="w-100 py-1 px-2">
        <h5 className="text-muted text-ellipsis my-0">{cube.name}</h5>
        <div className="text-muted text-ellipsis">
          {cube.overrideCategory
            ? cube.card_count +
              ' Card ' +
              (cube.categoryPrefixes.length > 0 ? cube.categoryPrefixes.join(' ') + ' ' : '') +
              cube.categoryOverride +
              ' Cube'
            : cube.card_count + ' Card ' + cube.type + ' Cube'}
        </div>
        <em className="text-muted">
          Designed by <a href={'/user/view/' + cube.owner}>{cube.owner_name}</a>
        </em>
      </div>
    </Card>
  );
}

/*
        
*/

export default CubePreview;
