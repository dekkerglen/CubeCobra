import React, { useCallback, useContext, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, FormGroup, FormText, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import { postJson } from 'utils/CSRF';
import { formDataObject } from 'utils/Form';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';
import LoadingButton from 'components/LoadingButton';

const visibilityHelp = {
  public: 'Anyone can search for and see your cube',
  unlisted: 'Anyone with a link can see your cube',
  private: 'Only you can see your cube',
};

const convertVisibility = (cube) => {
  if (!cube.isListed && cube.isPrivate) return 'private';
  if (!cube.isListed && !cube.isPrivate) return 'unlisted';
  return 'public';
};

const CubeSettingsModal = ({ addAlert, onCubeUpdate, isOpen, toggle }) => {
  const { cube, cubeID, setCube } = useContext(CubeContext);
  const [visibility, setVisibility] = useState(convertVisibility(cube));
  const formRef = useRef();

  const handleSave = useCallback(async () => {
    const formObject = formDataObject(formRef.current);
    const response = await postJson(`/cube/api/settings/${cubeID}`, formObject);
    const json = await response.json();
    // eslint-disable-next-line no-underscore-dangle
    delete formObject._csrf;
    if (response.ok) {
      onCubeUpdate({ ...cube, ...formObject });
      setCube((current) => ({ ...current, ...formObject }));
    } else {
      for (const error of json.errors) {
        addAlert('danger', error);
      }
      addAlert('danger', json.message);
    }
    toggle();
  }, [toggle, addAlert, onCubeUpdate, cube, cubeID, setCube, formRef]);

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Edit Settings</ModalHeader>
      <ModalBody>
        <CSRFForm innerRef={formRef}>
          <FormGroup check>
            <Input
              id="privatePrices"
              name="privatePrices"
              type="checkbox"
              defaultChecked={cube.privatePrices || false}
            />
            <Label for="privatePrices">Hide Total Prices</Label>
          </FormGroup>
          <FormGroup check>
            <Input
              id="disableNotifications"
              name="disableNotifications"
              type="checkbox"
              defaultChecked={cube.disableNotifications || false}
            />
            <Label for="disableNotifications">Disable Draft Notifications</Label>
          </FormGroup>
          <FormGroup check>
            <Input id="useCubeElo" name="useCubeElo" type="checkbox" defaultChecked={cube.useCubeElo || false} />
            <Label for="useCubeElo">Use Cube Elo instead of Global Elo</Label>
          </FormGroup>
          <FormGroup>
            <Label for="visibility">Cube Visibility</Label>
            <CustomInput
              id="visibility"
              name="visibility"
              type="select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </CustomInput>
            <FormText>{visibilityHelp[visibility]}</FormText>
          </FormGroup>
          <FormGroup>
            <Label for="defaultStatus">Default Status</Label>
            <Input id="defaultStatus" name="defaultStatus" type="select" defaultValue={cube.defaultStatus || false}>
              {['Owned', 'Not Owned'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Input>
          </FormGroup>
          <FormGroup>
            <Label for="defaultPrinting">Default Printing</Label>
            <Input
              id="defaultPrinting"
              name="defaultPrinting"
              type="select"
              defaultValue={cube.defaultPrinting || false}
            >
              <option value="recent">Most Recent</option>
              <option value="first">First</option>
            </Input>
          </FormGroup>
        </CSRFForm>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>{' '}
        <LoadingButton color="success" onClick={handleSave}>
          Save Changes
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};

CubeSettingsModal.propTypes = {
  addAlert: PropTypes.func.isRequired,
  onCubeUpdate: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default CubeSettingsModal;
