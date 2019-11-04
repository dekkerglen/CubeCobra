import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import BlogPost from './components/BlogPost';
import PagedList from './components/PagedList';
import CubePreview from './components/CubePreview';

import { Card, Col, Row, CardHeader , CardBody, CardFooter} from 'reactstrap';


class Dashboard extends Component {
  constructor(props) {
    super(props);
    
    this.newCube = this.newCube.bind(this);

    this.state = {  
      cubes_expanded: false
    };
  }

  newCube(evt)
  {
    evt.preventDefault();
    //TODO: remove jquery dependency
    $('#cubeModal').modal('show');
  }

  render() {
    //List of your cubes
    //List of drafts of your cube
    //List of replies to your blogs  
    const {posts, cubes} = this.props;
    return (       
      <Row>
        <Col sm="12" xs="12" md="6" lg="6" >
          <Card>
            <CardHeader><h5>Your Cubes</h5></CardHeader>
            <CardBody className="py-2 px-2">      
              <Row>   
                {cubes.length > 0 ?
                  cubes.slice(0,2).map(cube =>
                    <Col key={cube._id} sm="12" xs="12" md="6" lg="6" >
                      <CubePreview cube={cube}/>
                    </Col>
                  )
                :
                  <p className="m-2">You don't have any cubes. <a href="#" onClick={this.newCube}>Add a new cube?</a></p>
                }  
              </Row>
            </CardBody>
            <CardFooter>
              {cubes.length > 2 &&
                <a href={'/user/view/'+cubes[0].owner}>View All</a>
              }
            </CardFooter>
          </Card>
        </Col>
        <Col sm="12" xs="12" md="6" lg="6" >
          <Card>
            <CardHeader><h5>Recent Drafts</h5></CardHeader>
          </Card>
        </Col>
        <Col sm="12" xs="12" md="12" lg="12" className="my-2">
          <Card>
            <CardHeader><h5>Feed</h5></CardHeader>
            <CardBody className="pt-0 pb-1 px-2">
              {posts.length > 0 ?
                <PagedList pageSize={10} rows={posts.slice(0).reverse().map(post =>
                  <BlogPost key={post._id} post={post} canEdit={false} userid={userid} loggedIn={true} />)}>
                </PagedList>
              :
                <p>No posts to show. <a href="/explore">Find some cubes</a> to follow!</p>
              }
            </CardBody>
          </Card>
        </Col>
      </Row>   
    );
  }
}

const posts = JSON.parse(document.getElementById('blogData').value);  
const cubes = JSON.parse(document.getElementById('cubeData').value);  
const userid = document.getElementById('userid').value;
const wrapper = document.getElementById('react-root');
const element = <Dashboard posts={posts} userid={userid} cubes={cubes}/>;
wrapper ? ReactDOM.render(element, wrapper) : false;
