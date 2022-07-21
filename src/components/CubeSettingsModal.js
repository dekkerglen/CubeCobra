import React, { useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, FormGroup, FormText, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import { postJson } from 'utils/CSRF';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';
import LoadingButton from 'components/LoadingButton';

const visibilityHelp = {
  pu: 'Anyone can search for and see your cube',
  un: 'Anyone with a link can see your cube',
  pr: 'Only you can see your cube',
};

const CubeSettingsModal = ({ addAlert, onCubeUpdate, isOpen, toggle }) => {
  const { cube } = useContext(CubeContext);
  const [state, setState] = useState(cube);

  const handleSave = useCallback(async () => {
    const response = await postJson(`/cube/api/settings/${cube.Id}`, state);
    const json = await response.json();
    if (response.ok) {
      onCubeUpdate(state);
    } else {
      console.log(json);
      if (json.errors) {
        for (const error of json.errors) {
          addAlert('danger', error);
        }
      } else {
        addAlert('danger', json.message);
      }
    }
    toggle();
  }, [cube.Id, toggle, onCubeUpdate, state, addAlert]);

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Edit Settings</ModalHeader>
      <ModalBody>
        <CSRFForm>
          <FormGroup check>
            <Input
              id="PrivatePrices"
              name="PrivatePrices"
              type="checkbox"
              checked={state.PriceVisibility === 'pr'}
              onChange={(e) => {
                setState({ ...state, PriceVisibility: e.target.checked ? 'pr' : 'pu' });
              }}
            />
            <Label for="PrivatePrices">Hide Total Prices</Label>
          </FormGroup>
          <FormGroup check>
            <Input
              id="DisableNotifications"
              name="DisableNotifications"
              type="checkbox"
              checked={state.DisableNotifications}
              onChange={(e) => {
                setState({ ...state, DisableNotifications: e.target.checked });
              }}
            />
            <Label for="DisableNotifications">Disable Draft Notifications</Label>
          </FormGroup>
          <FormGroup>
            <Label for="Visibility">Cube Visibility</Label>
            <Input
              id="Visibility"
              name="Visibility"
              type="select"
              value={state.Visibility}
              onChange={(e) => {
                setState({ ...state, Visibility: e.target.value });
              }}
            >
              <option value="pu">Public</option>
              <option value="un">Unlisted</option>
              <option value="pr">Private</option>
            </Input>
            <FormText>{visibilityHelp[state.Visibility]}</FormText>
          </FormGroup>
          <FormGroup>
            <Label for="DefaultStatus">Default Status</Label>
            <Input
              id="DefaultStatus"
              name="DefaultStatus"
              type="select"
              value={state.DefaultStatus}
              onChange={(e) => {
                setState({ ...state, DefaultStatus: e.target.value });
              }}
            >
              {['Owned', 'Not Owned'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Input>
          </FormGroup>
          <FormGroup>
            <Label for="DefaultPrinting">Default Printing</Label>
            <Input
              id="DefaultPrinting"
              name="DefaultPrinting"
              type="select"
              value={state.DefaultPrinting}
              onChange={(e) => {
                setState({ ...state, DefaultPrinting: e.target.value });
              }}
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
        <LoadingButton color="accent" onClick={handleSave}>
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
