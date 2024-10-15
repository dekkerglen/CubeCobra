import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import RadioButtonGroup from 'components/base/RadioButtonGroup';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import MtgImage from 'components/MtgImage';
import TagInput from 'components/TagInput';
import TextEntry from 'components/TextEntry';
import Cube from 'datatypes/Cube';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { csrfFetch } from 'utils/CSRF';
import { getCubeDescription } from 'utils/Util';
interface CubeOverviewModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
}

const CubeOverviewModal: React.FC<CubeOverviewModalProps> = ({ isOpen, setOpen, cube }) => {
  const [state, setState] = useState<Cube>(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.imageName);
  const [imageDict, setImageDict] = useState<Record<string, string>>({});
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      cube: JSON.stringify(state),
    }),
    [state],
  );

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

  return (
    <Modal lg isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Edit Overview
        </Text>
      </ModalHeader>
      <CSRFForm method="POST" action={`/cube/editoverview`} ref={formRef} formData={formData}>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Input
              label="Cube Name"
              value={state.name}
              required
              onChange={(event) => setState({ ...state, name: event.target.value })}
            />
            <Text semibold md>
              Category: {getCubeDescription(state)}
            </Text>
            <Row>
              <Col xs={6}>
                <RadioButtonGroup
                  selected={state.categoryOverride || ''}
                  setSelected={(value) => setState({ ...state, categoryOverride: value })}
                  options={[
                    { value: '', label: 'None' },
                    { value: 'Vintage', label: 'Vintage' },
                    { value: 'Legacy+', label: 'Legacy+' },
                    { value: 'Legacy', label: 'Legacy' },
                    { value: 'Modern', label: 'Modern' },
                    { value: 'Premodern', label: 'Premodern' },
                    { value: 'Pioneer', label: 'Pioneer' },
                    { value: 'Historic', label: 'Historic' },
                    { value: 'Standard', label: 'Standard' },
                    { value: 'Set', label: 'Set' },
                  ]}
                />
              </Col>
              <Col xs={6}>
                <Flexbox direction="col" gap="2">
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
                    'Desert',
                  ].map((label) => (
                    <Checkbox
                      key={label}
                      label={label}
                      checked={(state.categoryPrefixes || []).includes(label)}
                      setChecked={(checked) => {
                        if (checked) {
                          setState({ ...state, categoryPrefixes: [...(state.categoryPrefixes || []), label] });
                        } else {
                          setState({
                            ...state,
                            categoryPrefixes: (state.categoryPrefixes || []).filter((x) => x !== label),
                          });
                        }
                      }}
                    />
                  ))}
                </Flexbox>
              </Col>
            </Row>
            <Text semibold md>
              Image
            </Text>
            <Row>
              <Col xs={12} sm={6} md={6} lg={6}>
                <Card>
                  <CardHeader>
                    <Text semibold lg>
                      Preview
                    </Text>
                  </CardHeader>
                  <MtgImage image={state.image} showArtist />
                </Card>
              </Col>
            </Row>
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
            <Text semibold md>
              Description
            </Text>
            <TextEntry
              name="blog"
              value={state.description}
              setValue={(value) => setState({ ...state, description: value })}
              maxLength={100000}
            />
            <TagInput
              label="Tags"
              tags={state.tags.map((tag) => ({ text: tag, id: tag }))}
              addTag={(tag) => setState({ ...state, tags: [...state.tags, tag.text] })}
              deleteTag={(index) => {
                const newTags = [...state.tags];
                newTags.splice(index, 1);
                setState({ ...state, tags: newTags });
              }}
            />
            <Input
              label="Short ID"
              className="form-control"
              id="shortId"
              name="shortId"
              type="text"
              value={state.shortId}
              onChange={(event) => setState({ ...state, shortId: event.target.value })}
              required
              placeholder="Give this cube an easy to remember URL."
            />
            <Text semibold sm>
              Changing the short ID may break existing links to your cube.
            </Text>
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" className="w-full" gap="2">
            <Button block color="danger" onClick={() => setOpen(false)}>
              Close
            </Button>
            <LoadingButton color="primary" block onClick={() => formRef.current?.submit()}>
              Save Changes
            </LoadingButton>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default CubeOverviewModal;
