import React from 'react';

import { Card, CardHeader } from 'reactstrap';


class CubePreview extends React.Component {
  constructor(props) 
  {
      super(props);
  }

  get_cube_id(cube) {
    if (cube.urlAlias) return cube.urlAlias;
    if (cube.shortID) return cube.shortID;
    return cube._id;
  }

  render() {
    var cube = this.props.cube;
    return (
      <Card >
        <CardHeader>
          <h5>{cube.name}</h5>
          {cube.type &&
            <a>{cube.card_count} Card {cube.type} Cube<br/></a>
          }
          <em>Designed by <a href={'/user/view/'+cube.owner}>{cube.owner_name}</a></em>
        </CardHeader>
        <a href={'/cube/overview/'+this.get_cube_id(cube)}><img className="card-img-top cube-preview-image" src={cube.image_uri}/></a>
        <em className="text-right p-1">Art by {cube.image_artist}</em>
        <a className="btn btn-success rounded-0" href={'/cube/overview/'+this.get_cube_id(cube)}>View</a>
      </Card>
    );
  }
}

export default CubePreview