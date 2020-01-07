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
  FormGroup,
  Label,
  Input,
  CardBody,
  Button,
} from 'reactstrap';

import { csrfFetch } from '../util/CSRF';
import { fromEntries } from '../util/Util';
import TagInput from './TagInput';
import { TagContextProvider } from './TagContext';
import TextEntry from './TextEntry';
import AutocompleteInput from './AutocompleteInput';

class CubeOverviewModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      tags: props.cube.tags.map((tag) => ({ id: tag, text: tag })),
      cube: JSON.parse(JSON.stringify(props.cube)),
      description: props.cube.descriptionhtml ? props.cube.descriptionhtml : props.cube.description,
      image_dict: {},
    };

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleApply = this.handleApply.bind(this);
    this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
    this.imageNameChange = this.imageNameChange.bind(this);

    this.tagActions = {
      addTag: this.addTag,
      deleteTag: this.deleteTag,
    };

    this.loadImageDict();
  }

  async loadImageDict() {
    //load the card images
    const image_resp = await fetch('/cube/api/imagedict');
    const image_json = await image_resp.json();
    this.setState({ image_dict: image_json.dict });
  }

  open() {
    this.setState({
      isOpen: true,
    });
  }

  close() {
    this.setState({
      isOpen: false,
    });
  }

  error(message) {
    this.props.onError(message);
  }

  handleDescriptionChange(e) {
    var value = e.target.value;
    this.setState((prevState) => ({
      cube: {
        ...prevState.cube,
        descriptionhtml: value,
      },
    }));
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

  imageNameChange(e) {
    var value = e.target.value;
    this.setState((prevState) => ({
      cube: {
        ...prevState.cube,
        image_name: value,
      },
    }));
    if (this.state.image_dict[value]) {
      var url = this.state.image_dict[value].uri;
      var artist = this.state.image_dict[value].artist;
      this.setState((prevState) => ({
        cube: {
          ...prevState.cube,
          image_artist: artist,
          image_uri: url,
        },
      }));
    }
  }

  handleChange(e) {
    switch (e.target.name) {
      case 'name':
        var value = e.target.value;
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            name: value,
          },
        }));
        break;
      case 'isListed':
        var value = e.target.checked;
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            isListed: value,
          },
        }));
        break;
      case 'privatePrices':
        var value = e.target.checked;
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            privatePrices: value,
          },
        }));
        break;
      case 'urlAlias':
        var value = e.target.value;
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            urlAlias: value,
          },
        }));
        break;
      case 'overrideCategory':
        var value = e.target.checked;
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            overrideCategory: value,
          },
        }));
        break;
      case 'category':
        var value = e.target.value;
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            categoryOverride: value,
          },
        }));
        break;
      case 'category_prefix':
        var value = e.target.checked;
        var id = e.target.value;
        var prefixes = this.state.cube.categoryPrefixes;

        if (prefixes.includes(id) && !value) {
          prefixes = prefixes.filter(function(e) {
            return e !== id;
          });
        } else if (!prefixes.includes(id) && value) {
          prefixes.push(id);
        }
        this.setState((prevState) => ({
          cube: {
            ...prevState.cube,
            categoryPrefixes: prefixes,
          },
        }));
        break;
    }
  }

  async handleApply(event) {
    event.preventDefault();

    var cube = this.state.cube;
    cube.tags = this.state.tags;
    await csrfFetch('/cube/api/editoverview', {
      method: 'POST',
      body: JSON.stringify(cube),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (response.status == 200) {
          this.props.onCubeUpdate(this.state.cube);
          this.close();
        } else {
          this.error(response.statusText);
          this.close();
        }
      })
      .catch((err) => this.error(err));
  }

  render() {
    const { cube, tags, isOpen } = this.state;
    return (
      <>
        <a className="nav-link" href="#" onClick={this.open}>
          Edit Overview
        </a>

        <TagContextProvider
          cubeID={cube._id}
          defaultTagColors={cube.tag_colors}
          defaultShowTagColors={false}
          defaultTags={[]}
        >
          <Modal size="lg" isOpen={isOpen} toggle={this.close}>
            <ModalHeader toggle={this.close}>Edit Overview</ModalHeader>

            <form id="postBlogForm" method="POST" action="/cube/editoverview/cedh" autoComplete="off">
              <ModalBody>
                <h6>Cube Name</h6>
                <input
                  className="form-control"
                  name="name"
                  type="text"
                  value={cube.name}
                  onChange={this.handleChange}
                ></input>
                <br />

                <h6>Options</h6>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    name="isListed"
                    type="checkbox"
                    checked={cube.isListed}
                    onChange={this.handleChange}
                  />
                  <label className="form-check-label">Is Listed</label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    name="privatePrices"
                    type="checkbox"
                    checked={cube.privatePrices}
                    onChange={this.handleChange}
                  />
                  <label className="form-check-label">Hide Total Price</label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    name="overrideCategory"
                    type="checkbox"
                    checked={cube.overrideCategory}
                    onChange={this.handleChange}
                  />
                  <label className="form-check-label">Override Cube Category</label>
                </div>
                <br />

                <h6>Category</h6>

                <input
                  className="form-control"
                  name="name"
                  type="text"
                  disabled
                  value={
                    cube.overrideCategory
                      ? cube.card_count +
                        ' Card ' +
                        (cube.categoryPrefixes.length > 0 ? cube.categoryPrefixes.join(' ') + ' ' : '') +
                        cube.categoryOverride +
                        ' Cube'
                      : cube.card_count + ' Card ' + cube.type + ' Cube'
                  }
                />

                <Row>
                  <Col>
                    <FormGroup tag="fieldset">
                      {['Vintage', 'Legacy+', 'Legacy', 'Modern', 'Pioneer', 'Standard', 'Set'].map((label) => (
                        <FormGroup check key={label}>
                          <Label check>
                            <Input
                              type="radio"
                              name="category"
                              value={label}
                              disabled={cube.overrideCategory ? false : true}
                              checked={cube.categoryOverride == label}
                              onChange={this.handleChange}
                            />{' '}
                            {label}
                          </Label>
                        </FormGroup>
                      ))}
                    </FormGroup>
                  </Col>
                  <Col>
                    {['Powered', 'Unpowered', 'Pauper', 'Peasant', 'Budget', 'Silver-bordered'].map((label) => (
                      <div className="form-check" key={label}>
                        <input
                          className="form-check-input"
                          name="category_prefix"
                          value={label}
                          type="checkbox"
                          checked={cube.categoryPrefixes.includes(label)}
                          onChange={this.handleChange}
                          disabled={cube.overrideCategory ? false : true}
                        />
                        <label className="form-check-label">{label}</label>
                      </div>
                    ))}
                  </Col>
                </Row>

                <h6>Image</h6>
                <Row>
                  <Col xs="12" sm="6" md="6" lg="6">
                    <Card>
                      <CardHeader>Preview</CardHeader>
                      <img className="card-img-top w-100" src={cube.image_uri} />
                      <CardBody>
                        <a>Art by: {cube.image_artist}</a>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
                <br />
                <AutocompleteInput
                  treeUrl={'/cube/api/fullnames'}
                  treePath="cardnames"
                  type="text"
                  className="mr-2"
                  name="remove"
                  value={cube.image_name}
                  onChange={this.imageNameChange}
                  onSubmit={this.imageNameSubmit}
                  placeholder="Cardname for Image"
                  autoComplete="off"
                  data-lpignore
                />
                <br />

                <h6>Description</h6>
                <TextEntry
                  content={this.state.cube.descriptionhtml ? this.state.cube.descriptionhtml : ''}
                  handleChange={this.handleDescriptionChange}
                />
                <br />

                <h6>Tags</h6>
                <TagInput tags={tags} {...this.tagActions} />
                <br />

                <h6>Custom ID</h6>
                <input
                  className="form-control"
                  name="urlAlias"
                  type="text"
                  value={cube.urlAlias ? cube.urlAlias : ''}
                  onChange={this.handleChange}
                  placeholder="Give this cube an easy to remember URL."
                />
                <br />
              </ModalBody>
              <ModalFooter>
                <Button color="secondary" onClick={this.close}>
                  Close
                </Button>{' '}
                <Button color="success" onClick={this.handleApply}>
                  Save Changes
                </Button>
              </ModalFooter>
            </form>
          </Modal>
        </TagContextProvider>
      </>
    );
  }
}

export default CubeOverviewModal;
