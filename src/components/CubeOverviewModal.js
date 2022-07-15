import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

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
  FormText,
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';
import { getCubeDescription } from 'utils/Util';

import AutocompleteInput from 'components/AutocompleteInput';
import LoadingButton from 'components/LoadingButton';
import TagInput from 'components/TagInput';
import { TagContextProvider } from 'contexts/TagContext';
import TextEntry from 'components/TextEntry';

const CubeOverviewModal = ({ isOpen, toggle, cube, onError, onCubeUpdate }) => {
  const [state, setState] = useState(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.ImageName);
  const [imageDict, setImageDict] = useState({});

  useEffect(() => {
    const getData = async () => {
      // load the card images
      const response = await csrfFetch('/cube/api/imagedict');
      const json = await response.json();
      setImageDict(json.dict);
    };
    getData();
  }, []);

  const changeImage = useCallback(
    (event) => {
      const image = event.target.value;
      setImagename(image);
      if (imageDict[image.toLowerCase()]) {
        const url = imageDict[image.toLowerCase()].uri;
        const { artist } = imageDict[image.toLowerCase()];
        setState({ ...state, ImageName: image, ImageUri: url, ImageArtist: artist });
      }
    },
    [imageDict, setState, state],
  );

  const submit = useCallback(
    async (event) => {
      event.preventDefault();

      console.log('submitting', state);

      const response = await csrfFetch('/cube/api/editoverview', {
        method: 'POST',
        body: JSON.stringify(state),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const json = await response.json();
      if (response.ok) {
        onCubeUpdate(state);
        if (cube.ShortId !== state.ShortId) {
          window.location.href = `/cube/overview/${encodeURIComponent(state.ShortId || state.Id)}`;
        }
      } else if (json.message) {
        onError(json.message);
      } else if (json.errors) {
        for (const error of json.errors) {
          onError(error);
        }
      }
      toggle();
    },
    [cube, onCubeUpdate, onError, state, toggle],
  );

  return (
    <TagContextProvider
      cubeID={state.Id}
      defaultTagColors={state.TagColors}
      defaultShowTagColors={false}
      defaultTags={[]}
    >
      <Modal size="lg" isOpen={isOpen} toggle={toggle}>
        <ModalHeader toggle={toggle}>Edit Overview</ModalHeader>

        <form method="POST" action={`/cube/editoverview/${state.Id}`} autoComplete="off">
          <ModalBody>
            <h6>Cube Name</h6>
            <input
              className="form-control"
              name="name"
              type="text"
              value={state.Name}
              required
              onChange={(event) => setState({ ...state, Name: event.target.value })}
            />
            <br />
            <h6>Category</h6>
            <input className="form-control" name="name" type="text" disabled value={getCubeDescription(state)} />
            <Row>
              <Col>
                <FormGroup tag="fieldset">
                  {[null, 'Vintage', 'Legacy+', 'Legacy', 'Modern', 'Pioneer', 'Historic', 'Standard', 'Set'].map(
                    (label) => (
                      <FormGroup check key={label}>
                        <Label check>
                          <Input
                            type="radio"
                            name="categoryOverride"
                            value={label}
                            checked={state.CategoryOverride === label}
                            onChange={(event) => setState({ ...state, CategoryOverride: event.target.value })}
                          />{' '}
                          {label || <i>[None]</i>}
                        </Label>
                      </FormGroup>
                    ),
                  )}
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
                      checked={(state.CategoryPrefixes || []).includes(label)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setState({ ...state, CategoryPrefixes: [...(state.CategoryPrefixes || []), label] });
                        } else {
                          setState({
                            ...state,
                            CategoryPrefixes: (state.CategoryPrefixes || []).filter((x) => x !== label),
                          });
                        }
                      }}
                    />
                    <label className="form-check-label" htmlFor={`categoryPrefix${label}`}>
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
                  <img className="card-img-top w-100" src={state.ImageUri} alt={state.ImageUri} />
                  <CardBody>Art by: {state.ImageArtist}</CardBody>
                </Card>
              </Col>
            </Row>
            <br />
            <AutocompleteInput
              treeUrl="/cube/api/fullnames"
              treePath="cardnames"
              type="text"
              className="me-2"
              name="remove"
              value={imagename}
              onChange={changeImage}
              placeholder="Cardname for Image"
              autoComplete="off"
              data-lpignore
            />
            <br />
            <h6>Description</h6>
            <TextEntry
              name="blog"
              value={state.Description}
              onChange={(event) => setState({ ...state, Description: event.target.value })}
              maxLength={100000}
            />
            <FormText>
              Having trouble formatting your posts? Check out the{' '}
              <a href="/markdown" target="_blank">
                markdown guide
              </a>
              .
            </FormText>
            <br />
            <h6>Tags</h6>
            <TagInput
              tags={state.Tags}
              addTag={(tag) => setState({ ...state, Tags: [...state.Tags, tag] })}
              deleteTag={(index) => {
                const newTags = [...state.Tags];
                newTags.splice(index, 1);
                setState({ ...state, Tags: newTags });
              }}
              reorderTag={(tag, currInex, newIndex) => {
                const newTags = [...state.Tags];
                newTags.splice(newIndex, 0, newTags.splice(currInex, 1)[0]);
                setState({ ...state, Tags: newTags });
              }}
            />
            <br />
            <h6>Short ID</h6>
            <input
              className="form-control"
              id="ShortId"
              name="ShortId"
              type="text"
              value={state.ShortId}
              onChange={(event) => setState({ ...state, ShortId: event.target.value })}
              required
              placeholder="Give this cube an easy to remember URL."
            />
            <FormText>Changing the short ID may break existing links to your cube.</FormText>
            <br />
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={toggle}>
              Close
            </Button>{' '}
            <LoadingButton color="accent" onClick={submit}>
              Save Changes
            </LoadingButton>
          </ModalFooter>
        </form>
      </Modal>
    </TagContextProvider>
  );
};

CubeOverviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cube: CubePropType.isRequired,
  onError: PropTypes.func.isRequired,
  onCubeUpdate: PropTypes.func.isRequired,
};
CubeOverviewModal.defaultProps = {};

export default CubeOverviewModal;
