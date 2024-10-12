import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Col,
  FormGroup,
  FormText,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
} from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import AutocompleteInput from 'components/AutocompleteInput';
import LoadingButton from 'components/LoadingButton';
import MtgImage from 'components/MtgImage';
import TagInput from 'components/TagInput';
import TextEntry from 'components/TextEntry';
import { csrfFetch } from 'utils/CSRF';
import { getCubeDescription } from 'utils/Util';

const CubeOverviewModal = ({ isOpen, toggle, cube, onError, onCubeUpdate }) => {
  const [state, setState] = useState(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.imageName);
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
    (image) => {
      setImagename(image);
      if (imageDict[image.toLowerCase()]) {
        setState({ ...state, imageName: image });
      }
    },
    [imageDict, setState, state],
  );

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
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
        if (cube.shortId !== state.shortId) {
          window.location.href = `/cube/overview/${encodeURIComponent(state.shortId || state.id)}`;
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
    <Modal size="lg" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Edit Overview</ModalHeader>

      <form method="POST" action={`/cube/editoverview/${state.id}`} autoComplete="off">
        <ModalBody>
          <h6>Cube name</h6>
          <input
            className="form-control"
            name="name"
            type="text"
            value={state.name}
            required
            onChange={(event) => setState({ ...state, name: event.target.value })}
          />
          <br />
          <h6>Category</h6>
          <input className="form-control" name="name" type="text" disabled value={getCubeDescription(state)} />
          <Row>
            <Col>
              <FormGroup tag="fieldset">
                {[
                  null,
                  'Vintage',
                  'Legacy+',
                  'Legacy',
                  'Modern',
                  'Premodern',
                  'Pioneer',
                  'Historic',
                  'Standard',
                  'Set',
                ].map((label) => (
                  <FormGroup check key={label}>
                    <Label check>
                      <Input
                        type="radio"
                        name="categoryOverride"
                        value={label}
                        checked={state.categoryOverride === label}
                        onChange={(event) => setState({ ...state, categoryOverride: event.target.value })}
                      />{' '}
                      {label || <i>[None]</i>}
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
                    checked={(state.categoryPrefixes || []).includes(label)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setState({ ...state, categoryPrefixes: [...(state.categoryPrefixes || []), label] });
                      } else {
                        setState({
                          ...state,
                          categoryPrefixes: (state.categoryPrefixes || []).filter((x) => x !== label),
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
          <h6>image</h6>
          <Row>
            <Col xs={12} sm={6} md={6} lg={6}>
              <Card>
                <CardHeader>Preview</CardHeader>
                <MtgImage image={state.image} showArtist />
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
            setValue={changeImage}
            placeholder="Cardname for image"
            autoComplete="off"
            data-lpignore
            noMargin
          />
          <br />
          <h6>description</h6>
          <TextEntry
            name="blog"
            value={state.description}
            onChange={(event) => setState({ ...state, description: event.target.value })}
            maxLength={100000}
          />
          <br />
          <h6>tags</h6>
          <TagInput
            tags={state.tags.map((tag) => ({ text: tag, id: tag }))}
            addTag={(tag) => setState({ ...state, tags: [...state.tags, tag.text] })}
            deleteTag={(index) => {
              const newTags = [...state.tags];
              newTags.splice(index, 1);
              setState({ ...state, tags: newTags });
            }}
            reorderTag={(tag, currInex, newIndex) => {
              const newTags = [...state.tags];
              newTags.splice(newIndex, 0, newTags.splice(currInex, 1)[0]);
              setState({ ...state, tags: newTags });
            }}
          />
          <br />
          <h6>short ID</h6>
          <input
            className="form-control"
            id="shortId"
            name="shortId"
            type="text"
            value={state.shortId}
            onChange={(event) => setState({ ...state, shortId: event.target.value })}
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
