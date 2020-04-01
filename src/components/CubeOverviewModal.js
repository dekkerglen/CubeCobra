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

import { csrfFetch } from 'utils/CSRF';

import AutocompleteInput from 'components/AutocompleteInput';
import LoadingButton from 'components/LoadingButton';
import TagInput from 'components/TagInput';
import { TagContextProvider } from 'components/TagContext';
import TextEntry from 'components/TextEntry';

class CubeOverviewModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      tags: (props.cube.tags ? props.cube.tags : []).map((tag) => ({ id: tag, text: tag })),
      cube: JSON.parse(JSON.stringify(props.cube)),
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

  open(event) {
    event.preventDefault();
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
        raw_desc: value,
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
    if (this.state.image_dict[value.toLowerCase()]) {
      var url = this.state.image_dict[value.toLowerCase()].uri;
      var artist = this.state.image_dict[value.toLowerCase()].artist;
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
    const target = e.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    if (e.target.name === 'category_prefix') {
      var id = target.value;
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
    } else {
      this.setState((prevState) => ({
        cube: {
          ...prevState.cube,
          [target.name]: value,
        },
      }));
    }
  }

  async handleApply(event) {
    event.preventDefault();

    const cube = { ...this.state.cube };
    cube.tags = this.state.tags.map((tag) => tag.text);
    cube.descriptionhtml = cube.raw_desc;
    const response = await csrfFetch('/cube/api/editoverview', {
      method: 'POST',
      body: JSON.stringify(cube),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const json = await response.json();
    if (response.ok) {
      this.props.onCubeUpdate({
        ...this.state.cube,
        descriptionhtml: json.descriptionhtml,
      });
    } else {
      if (json.message) {
        this.error(json.message);
      } else if (json.errors) {
        for (const error of json.errors) {
          this.error(error);
        }
      }
    }
    this.close();
  }

  render() {
    const { cube, cubeID, tags, isOpen } = this.state;
    return (
      <>
        <a className="nav-link" href="#" onClick={this.open}>
          Edit Overview
        </a>

        <TagContextProvider
          cubeID={cubeID}
          defaultTagColors={cube.tag_colors}
          defaultShowTagColors={false}
          defaultTags={[]}
        >
          <Modal size="lg" isOpen={isOpen} toggle={this.close}>
            <ModalHeader toggle={this.close}>Edit Overview</ModalHeader>

            <form method="POST" action={`/cube/editoverview/${cubeID}`} autoComplete="off">
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
                    id="overrideCategory"
                    name="overrideCategory"
                    type="checkbox"
                    checked={cube.overrideCategory}
                    onChange={this.handleChange}
                  />
                  <label className="form-check-label" for="overrideCategory">
                    Override Cube Category
                  </label>
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
                              name="categoryOverride"
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
                    {[
                      'Powered',
                      'Unpowered',
                      'Pauper',
                      'Peasant',
                      'Budget',
                      'Silver-bordered',
                      'Commander',
                      'Battle Box',
                      'Multiplayer',
                      'Judge Tower',
                    ].map((label) => (
                      <div className="form-check" key={label}>
                        <input
                          className="form-check-input"
                          name="category_prefix"
                          id={`categoryPrefix${label}`}
                          value={label}
                          type="checkbox"
                          checked={(cube.categoryPrefixes ? cube.categoryPrefixes : []).includes(label)}
                          onChange={this.handleChange}
                          disabled={cube.overrideCategory ? false : true}
                        />
                        <label className="form-check-label" for={`categoryPrefix${label}`}>
                          {label}
                        </label>
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
                  name="blog"
                  value={cube.raw_desc && cube.raw_desc !== 'undefined' ? cube.raw_desc : cube.description}
                  onChange={this.handleDescriptionChange}
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
                <LoadingButton color="success" onClick={this.handleApply}>
                  Save Changes
                </LoadingButton>
              </ModalFooter>
            </form>
          </Modal>
        </TagContextProvider>
      </>
    );
  }
}

export default CubeOverviewModal;
