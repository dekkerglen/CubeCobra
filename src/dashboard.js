import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import BlogPost from './components/BlogPost';
import PagedList from './components/PagedList';
import CubePreview from './components/CubePreview';
import DeckPreview from './components/DeckPreview';

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
    const {posts, cubes, decks} = this.props;
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
            <CardHeader><h5>Recent Drafts of Your Cubes</h5></CardHeader>
            <CardBody className="p-0">  
                {decks.length > 0 ?
                  decks.map(deck =>
                    <DeckPreview deck={deck}/>
                  )
                :
                  <p className="m-2">Nobody has drafted your cubes! Perhaps try reaching out on the <a href="https://discord.gg/Hn39bCU">Discord draft exchange?</a></p>
                }  
            </CardBody>
            <CardFooter>
              {cubes.length > 2 &&
                <a href='/dashboard/decks/0'>View All</a>
              }
            </CardFooter>
          </Card>
        </Col>
        <Col sm="12" xs="12" md="12" lg="12" className="mb-2 mt-4">
          <Card><CardHeader><h4>Feed</h4></CardHeader></Card>
          {posts.length > 0 ?
            <PagedList pageSize={10} rows={posts.slice(0).reverse().map(post =>
              <BlogPost key={post._id} post={post} canEdit={false} userid={userid} loggedIn={true} />)}>
            </PagedList>
          :
            <p>No posts to show. <a href="/explore">Find some cubes</a> to follow!</p>
          }
        </Col>
      </Row>   
    );
  }
}

const posts = JSON.parse(document.getElementById('blogData').value);
const cubes = JSON.parse(document.getElementById('cubeData').value);
const decks = JSON.parse(document.getElementById('decksData').value);
const userid = document.getElementById('userid').value;
const wrapper = document.getElementById('react-root');
const element = <Dashboard posts={posts} userid={userid} cubes={cubes} decks={decks}/>;
wrapper ? ReactDOM.render(element, wrapper) : false;
