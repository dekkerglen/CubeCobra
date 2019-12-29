import React from 'react';

import { Card, CardHeader } from 'reactstrap';

class CubePreview extends React.Component {
  constructor(props) {
    super(props);
  }

  getCubeId(cube) {
    if (cube.urlAlias) return cube.urlAlias;
    if (cube.shortID) return cube.shortID;
    return cube._id;
  }

  render() {
    var cube = this.props.cube;
    return (
      <a href={'/cube/overview/' + this.getCubeId(cube)} className="no-underline-hover">
        <Card className="cube-preview-card">
          <div className="cube-preview-element">
            <img className="card-img-top cube-image-preview" src={cube.image_uri} />
            <em className="cube-preview-artist">Art by {cube.image_artist}</em>
          </div>
          <div className="cube-preview-body py-1 px-2">
            <h5 className="text-muted cube-preview-text my-0">{cube.name}</h5>
            <div className="text-muted cube-category">
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
      </a>
    );
  }
}

/*
        
*/

export default CubePreview;
