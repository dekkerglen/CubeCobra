import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Row, Col, Card, CardHeader, CardBody, CardText } from 'reactstrap';

import DynamicFlash from './components/DynamicFlash';
import BlogPost from './components/BlogPost';
import CSRFForm from './components/CSRFForm';

class CubeOverview extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {post, cube, price, owner, admin} = this.props;
    return (
      <>
      <DynamicFlash/>
      <Row>
        <Col md="4">
          <Card className="mt-3">
            <CardHeader>
              <h3>{cube.name}</h3>
            </CardHeader>
            <img className="card-img-top w-100" src={cube.image_uri}/>
            <em className="text-right p-1">Art by: {cube.image_artist}</em>
            <CardBody>
              {cube.type &&
                <>
                  <a>{cube.card_count} Card {cube.type} Cube</a>
                  <br/>
                </>
              }
              {!cube.privatePrices &&
                <>
                  <a>Approx: ${price}</a>
                  <br/>
                </>
              }
              <a href={"/cube/rss/" + cube._id}>RSS</a>
              <em>
                <h6>Designed by 
                  <a href={"/user/view/" + owner}> {owner}</a>
                </h6>
              </em>
              {admin &&
                <CSRFForm method='POST' id='featuredForm' action={'/cube/' + (cube.isFeatured ? 'unfeature' : 'feature') + cube._id}>
                    <Button color="success" type="submit"> {cube.isFeatured ? 'Remove from Featured' : 'Add to Featured'}</Button>
                </CSRFForm>
              }
            </CardBody>
          </Card>
        </Col>
        <Col>
            <Card className="mt-3">
              <CardHeader>
                <h5 className="card-title">Description</h5>
              </CardHeader>
              <CardBody>
                {cube.descriptionhtml ?
                  <CardText dangerouslySetInnerHTML={{__html: cube.descriptionhtml}}/>
                :
                  <CardText>{cube.description}</CardText>
                }
              </CardBody>
            </Card>
        </Col>
      </Row>
      {post &&
          <BlogPost key={post._id} post={post} canEdit={canEdit} userid={userid} loggedIn={loggedIn} />
      }
      </>
    );
  }
}

const loggedIn = document.getElementById('userid') != null;
const userid = loggedIn ? document.getElementById('userid').value : '';
const canEdit = document.getElementById('canEdit').value === 'true';
const blog = JSON.parse(document.getElementById('blogData').value);  
const cube = JSON.parse(document.getElementById('cubeData').value);  
const price = document.getElementById('priceData').value;  
const owner = document.getElementById('ownerData').value;  
const admin = document.getElementById('adminData').value === 'true';
const wrapper = document.getElementById('react-root');
const element = <CubeOverview post={blog} cube={cube} price={price} owner={owner} admin={admin}/>;
wrapper ? ReactDOM.render(element, wrapper) : false;
