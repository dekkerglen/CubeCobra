import React, { Component } from 'react';

import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Card,
  CardHeader,
  Row,
  Col,
} from 'reactstrap';

import { csrfFetch } from '../util/CSRF';
import { fromEntries } from '../util/Util';
import TagInput from './TagInput';
import TagContext from './TagContext';
import TextEntry from './TextEntry';

class CubeOverviewModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      tags: props.cube.tags,
      cube: JSON.parse(JSON.stringify(props.cube)),
      description: props.cube.descriptionhtml ? props.cube.descriptionhtml : props.cube.description
    };

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleDescriptionChange = this.handleDescriptionChange.bind(this);

    this.tagActions = {
      addTag: this.addTag,
      deleteTag: this.deleteTag,
    };
  }

  open() {
    this.setState({
      isOpen: true
    });
  }

  close() {
    this.setState({ 
      isOpen: false 
    });
  }

  error(message) {
    this.setState(({ alerts }) => ({
      alerts: [
        ...alerts,
        {
          color: 'danger',
          message,
        },
      ],
    }));
  }

  handleDescriptionChange(event) {
    this.setState({ description: event.target.value });
  }

  addTag(tag) {
    this.setState(({ tags }) => ({
      tags: [...tags, tag],
    }));
  }

  deleteTag(tagIndex) {
    this.setState(({ tags }) => ({
      tags: tags.filter((tag, i) => i !== tagIndex),
    }));
  }

  handleChange(e) {
    switch(e.target.name) {
      case 'name':
        var value = e.target.value;
        this.setState(prevState => ({
          cube: {
              ...prevState.cube,
              name: value,
          }
        }))
        break;
      case 'isListed':
        var value = e.target.checked;
        this.setState(prevState => ({
          cube: {
              ...prevState.cube,
              isListed: value,
          }
        }))
        break;
      case 'privatePrices':
        var value = e.target.checked;
        this.setState(prevState => ({
          cube: {
              ...prevState.cube,
              privatePrices: value,
          }
        }))
        break;
      case 'urlAlias':
        var value = e.target.value;
        this.setState(prevState => ({
          cube: {
              ...prevState.cube,
              urlAlias: value,
          }
        }))
        break;
    }
  }

  async handleApply(event) {
    event.preventDefault();
    

    this.close();    
  }

  render() {
    const { defaultTagColors, defaultShowTagColors, ...props } = this.props;
    const { cube, tags, isOpen } = this.state;
    
    return (
      <>
        <a className="nav-link" href="#" onClick={this.open}>Edit Overview</a>
        
        <TagContext.Provider
            cubeID={cube._id}
            defaultTagColors={cube.tag_colors}
            defaultShowTagColors={false}
            defaultTags={cube.tags}
          >
          <Modal size="lg" isOpen={isOpen} toggle={this.close} {...props}>
            <ModalHeader toggle={this.close}>Edit Overview</ModalHeader>
            
            <form id="postBlogForm" method="POST" action="/cube/editoverview/cedh" autoComplete="off">
              <ModalBody>              
                <h6>Cube Name</h6>
                <input className="form-control" name="name" type="text" value={cube.name} onChange={this.handleChange}></input>
                <br/>

                <h6>Options</h6>
                <div className="form-check">
                  <input className="form-check-input" name="isListed" type="checkbox" checked={cube.isListed} onChange={this.handleChange}/>
                  <label className="form-check-label">Is Listed</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" name="privatePrices" type="checkbox" checked={cube.privatePrices} onChange={this.handleChange}/>
                  <label className="form-check-label">Hide Total Price</label>
                </div>
                <br/>

                <h6>Image</h6>
                <Row>
                  <Col xs="12" sm="6" md="6" lg="6">
                    <Card>
                      <CardHeader>Preview</CardHeader>
                      <img className='card-img-top w-100' src={cube.image_uri} />
                    </Card>
                  </Col>
                </Row>
                <br/>
                
                <h6>Description</h6>
                <TextEntry content={this.state.description} handleChange={this.handleDescriptionChange}/>
                <br/>
                
                <h6>Tags</h6>
                <TagInput tags={tags} {...this.tagActions} />
                <br/>
                
                <h6>Custom ID</h6>
                <input className="form-control" 
                  name="urlAlias" 
                  type="text"
                  value={cube.urlAlias} 
                  onChange={this.handleChange} 
                  placeholder="Give this cube an easy to remember URL."></input>
                <br/>
                
              </ModalBody>
            </form>

          </Modal>
        </TagContext.Provider>
      </>
    );
  }
}

export default CubeOverviewModal;
