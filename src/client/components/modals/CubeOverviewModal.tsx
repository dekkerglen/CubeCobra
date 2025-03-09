import React, { useCallback, useContext, useEffect, useState } from 'react';

import { getCubeDescription } from 'utils/Util';

import Cube from '../../../datatypes/Cube';
import Image from '../../../datatypes/Image';
import { CSRFContext } from '../../contexts/CSRFContext';
import Alert from '../base/Alert';
import AutocompleteInput from '../base/AutocompleteInput';
import Button from '../base/Button';
import { Card, CardHeader } from '../base/Card';
import Checkbox from '../base/Checkbox';
import Input from '../base/Input';
import { Col, Flexbox, Row } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import RadioButtonGroup from '../base/RadioButtonGroup';
import Text from '../base/Text';
import LoadingButton from '../LoadingButton';
import MtgImage from '../MtgImage';
import TagInput from '../TagInput';
import TextEntry from '../TextEntry';

interface CubeOverviewModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cube: Cube;
}

interface AlertProps {
  color: string;
  message: string;
}

const CubeOverviewModal: React.FC<CubeOverviewModalProps> = ({ isOpen, setOpen, cube }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [state, setState] = useState<Cube>(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.imageName);
  const [imageDict, setImageDict] = useState<Record<string, Image>>({});
  const [fetched, setFetched] = useState(false);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);

  useEffect(() => {
    const getData = async () => {
      const response = await csrfFetch('/cube/api/imagedict');
      const json = await response.json();
      setImageDict(json.dict);
      setFetched(true);
    };
    if (isOpen && !fetched) {
      getData();
    }
  }, [csrfFetch, fetched, isOpen]);

  const changeImage = useCallback(
    (image: string) => {
      setImagename(image);
      if (imageDict[image.toLowerCase()]) {
        setState({ ...state, imageName: image, image: imageDict[image.toLowerCase()] });
      }
    },
    [imageDict, setState, state],
  );

  const saveChanges = useCallback(async () => {
    //Clear alerts when saving so easy to identify a new one appearing
    setAlerts([]);

    const response = await csrfFetch(`/cube/api/editoverview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cube: state,
      }),
    });

    const body = await response.json();
    if (response.ok) {
      //Reload page to ensure state is updated
      window.location.replace(body.redirect);
    } else {
      setAlerts([{ color: 'danger', message: body.error }]);
    }
  }, [csrfFetch, state]);

  return (
    <Modal lg isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Edit Overview
        </Text>
      </ModalHeader>
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
            addTag={(tag) => {
              if (!state.tags.includes(tag.text)) {
                setState({ ...state, tags: [...state.tags, tag.text] });
              }
            }}
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
          {alerts.map(({ color, message }) => (
            <Alert key={message} color={color} className="mt-2">
              {message}
            </Alert>
          ))}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" className="w-full" gap="2">
          <LoadingButton color="primary" block onClick={saveChanges}>
            Save Changes
          </LoadingButton>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CubeOverviewModal;
