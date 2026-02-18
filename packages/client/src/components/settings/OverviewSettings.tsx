import React, { useCallback, useContext, useEffect, useState } from 'react';

import Cube, { CUBE_CATEGORIES, CUBE_PREFIXES } from '@utils/datatypes/Cube';
import Image from '@utils/datatypes/Image';
import { getCubeDescription } from '@utils/Util';

import Alert from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import RadioButtonGroup from 'components/base/RadioButtonGroup';
import Text from 'components/base/Text';
import LoadingButton from 'components/LoadingButton';
import MtgImage from 'components/MtgImage';
import TextEntry from 'components/TextEntry';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

interface AlertProps {
  color: string;
  message: string;
}

const OverviewSettings: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [state, setState] = useState<Cube>(JSON.parse(JSON.stringify(cube)));
  const [imagename, setImagename] = useState(cube.imageName);
  const [imageDict, setImageDict] = useState<Record<string, Image>>({});
  const [fetched, setFetched] = useState(false);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const getData = async () => {
      const response = await csrfFetch('/cube/api/imagedict');
      const json = await response.json();
      setImageDict(json.dict);
      setFetched(true);
    };
    if (!fetched) {
      getData();
    }
  }, [csrfFetch, fetched]);

  // Detect changes
  useEffect(() => {
    const changed = JSON.stringify(state) !== JSON.stringify(cube) || imagename !== cube.imageName;
    setHasChanges(changed);
  }, [state, cube, imagename]);

  const changeImage = useCallback(
    (image: string) => {
      setImagename(image);
      if (imageDict[image.toLowerCase()]) {
        setState({ ...state, imageName: image, image: imageDict[image.toLowerCase()] });
      }
    },
    [imageDict, state],
  );

  const saveChanges = useCallback(async () => {
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
      window.location.replace(body.redirect);
    } else {
      setAlerts([{ color: 'danger', message: body.error }]);
    }
  }, [csrfFetch, state]);

  const resetChanges = () => {
    setState(JSON.parse(JSON.stringify(cube)));
    setImagename(cube.imageName);
    setAlerts([]);
  };

  if (cube.cardCount === 0) {
    return (
      <Card>
        <CardHeader>
          <Text semibold lg>
            Overview Settings
          </Text>
        </CardHeader>
        <CardBody>
          <Alert color="warning">
            Please add at least one card to the cube in order to edit the overview. This is a spam prevention mechanism.
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Flexbox direction="col" gap="3">
      {alerts.map(({ color, message }) => (
        <Alert key={message} color={color}>
          {message}
        </Alert>
      ))}
      <Card>
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold lg>
              Overview Settings
            </Text>
            <Flexbox direction="row" gap="2">
              <Button color="secondary" onClick={resetChanges} disabled={!hasChanges}>
                Reset
              </Button>
              <LoadingButton color="primary" onClick={saveChanges} disabled={!hasChanges}>
                Save Changes
              </LoadingButton>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="3">
            <Input
              label="Cube Name"
              value={state.name}
              required
              onChange={(event) => setState({ ...state, name: event.target.value })}
            />

            <div>
              <Text semibold md className="mb-2">
                Category: {getCubeDescription(state)}
              </Text>
              <Row>
                <Col xs={12} md={6}>
                  <RadioButtonGroup
                    selected={state.categoryOverride || ''}
                    setSelected={(value) => setState({ ...state, categoryOverride: value })}
                    options={[
                      { value: '', label: 'None' },
                      ...CUBE_CATEGORIES.map((item) => ({ value: item, label: item })),
                    ]}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Flexbox direction="col" gap="2">
                    {CUBE_PREFIXES.map((label) => (
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
            </div>

            <div>
              <Text semibold md className="mb-2">
                Image
              </Text>
              <Row className="mb-3">
                <Col xs={12} sm={6} md={4}>
                  <Card>
                    <CardHeader>
                      <Text semibold>Preview</Text>
                    </CardHeader>
                    <MtgImage image={state.image} showArtist />
                  </Card>
                </Col>
              </Row>
              <AutocompleteInput
                treeUrl="/cube/api/fullnames"
                treePath="cardnames"
                type="text"
                name="remove"
                value={imagename}
                setValue={changeImage}
                placeholder="Cardname for image"
                autoComplete="off"
              />
            </div>

            <Flexbox direction="col" gap="2">
              <Text semibold md>
                Brief
              </Text>
              <Text sm className="text-text-secondary">
                A short description displayed in the cube hero (max 500 characters)
              </Text>
              <TextEntry
                name="brief"
                value={state.brief || ''}
                setValue={(value) => setState({ ...state, brief: value })}
                maxLength={500}
              />
            </Flexbox>

            <div>
              <Input
                label="Short ID"
                id="shortId"
                name="shortId"
                type="text"
                value={state.shortId}
                onChange={(event) => setState({ ...state, shortId: event.target.value })}
                required
                placeholder="Give this cube an easy to remember URL."
              />
              <Text semibold sm className="text-muted mt-1">
                Changing the short ID may break existing links to your cube.
              </Text>
            </div>
          </Flexbox>
        </CardBody>
      </Card>
    </Flexbox>
  );
};

export default OverviewSettings;
