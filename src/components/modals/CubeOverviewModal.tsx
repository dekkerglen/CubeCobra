import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Row, Col, Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import AutocompleteInput from 'components/base/AutocompleteInput';
import LoadingButton from 'components/LoadingButton';
import MtgImage from 'components/MtgImage';
import TagInput from 'components/TagInput';
import TextEntry from 'components/TextEntry';
import { csrfFetch } from 'utils/CSRF';
import { getCubeDescription } from 'utils/Util';
import Cube from 'datatypes/Cube';
import Text from 'components/base/Text';

interface CubeOverviewModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
  onError: (message: string) => void;
  onCubeUpdate: (cube: Cube) => void;
}

const CubeOverviewModal: React.FC<CubeOverviewModalProps> = ({ isOpen, setOpen, cube, onError, onCubeUpdate }) => {
  const [state, setState] = useState<Cube>(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.imageName);
  const [imageDict, setImageDict] = useState<Record<string, string>>({});

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
    (image: string) => {
      setImagename(image);
      if (imageDict[image.toLowerCase()]) {
        setState({ ...state, imageName: image });
      }
    },
    [imageDict, setState, state],
  );

  const submit = useCallback(async () => {
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
    setOpen(false);
  }, [cube, onCubeUpdate, onError, state, setOpen]);

  return (
    <Modal md isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Edit Overview
        </Text>
      </ModalHeader>

      <form method="POST" action={`/cube/editoverview/${state.id}`} autoComplete="off">
        <ModalBody>
          <Text semibold sm>
            Cube name
          </Text>
          <input
            className="form-control"
            name="name"
            type="text"
            value={state.name}
            required
            onChange={(event) => setState({ ...state, name: event.target.value })}
          />
          <br />
          <Text semibold sm>
            Category
          </Text>
          <input className="form-control" name="name" type="text" disabled value={getCubeDescription(state)} />
          <Row>
            <Col>
              <fieldset>
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
                  <div key={label}>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="categoryOverride"
                        value={label || ''}
                        checked={state.categoryOverride === label}
                        onChange={(event) => setState({ ...state, categoryOverride: event.target.value })}
                      />
                      <span className="ml-2">{label || <i>[None]</i>}</span>
                    </label>
                  </div>
                ))}
              </fieldset>
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
          <Text semibold sm>
            image
          </Text>
          <Row>
            <Col xs={12} sm={6} md={6} lg={6}>
              <Card>
                <CardHeader>
                  <Text semibold lg>
                    Preview
                  </Text>
                </CardHeader>
                <CardBody>
                  <MtgImage image={state.image} showArtist />
                </CardBody>
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
          />
          <br />
          <Text semibold sm>
            description
          </Text>
          <TextEntry
            name="blog"
            value={state.description}
            setValue={(value) => setState({ ...state, description: value })}
            maxLength={100000}
          />
          <br />
          <Text semibold sm>
            tags
          </Text>
          <TagInput
            tags={state.tags.map((tag) => ({ text: tag, id: tag }))}
            addTag={(tag) => setState({ ...state, tags: [...state.tags, tag.text] })}
            deleteTag={(index) => {
              const newTags = [...state.tags];
              newTags.splice(index, 1);
              setState({ ...state, tags: newTags });
            }}
          />
          <br />
          <Text semibold sm>
            short ID
          </Text>
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
          <p className="text-sm text-gray-500">Changing the short ID may break existing links to your cube.</p>
          <br />
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" className="w-full justify-end">
            <button className="bg-gray-600 text-white px-4 py-2 rounded block" onClick={() => setOpen(false)}>
              Close
            </button>
            <LoadingButton className="bg-accent text-white px-4 py-2 rounded block ml-2" onClick={async () => submit()}>
              Save Changes
            </LoadingButton>
          </Flexbox>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default CubeOverviewModal;
