import React, { useCallback, useContext, useState } from 'react';
import { Button, FormGroup, FormText, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import CubeContext from 'contexts/CubeContext';
import { postJson } from 'utils/CSRF';

const visibilityHelp = {
  pu: 'Anyone can search for and see your cube',
  un: 'Anyone with a link can see your cube',
  pr: 'Only you can see your cube',
};

const CubeSettingsModal = ({ addAlert, onCubeUpdate, isOpen, toggle }) => {
  const { cube } = useContext(CubeContext);
  const [state, setState] = useState(cube);

  const handleSave = useCallback(async () => {
    const response = await postJson(`/cube/api/settings/${cube.id}`, state);
    const json = await response.json();
    if (response.ok) {
      onCubeUpdate(state);
    } else if (json.errors) {
      for (const error of json.errors) {
        addAlert('danger', error);
      }
    } else {
      addAlert('danger', json.message);
    }
    toggle();
  }, [cube.id, toggle, onCubeUpdate, state, addAlert]);

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
              checked={state.priceVisibility === 'pr'}
              onChange={(e) => {
                setState({ ...state, priceVisibility: e.target.checked ? 'pr' : 'pu' });
              }}
            />
            <Label for="PrivatePrices">Hide Total prices</Label>
          </FormGroup>
          <FormGroup check>
            <Input
              id="disableAlerts"
              name="disableAlerts"
              type="checkbox"
              checked={state.disableAlerts}
              onChange={(e) => {
                setState({ ...state, disableAlerts: e.target.checked });
              }}
            />
            <Label for="disableAlerts">Disable Draft Notifications</Label>
          </FormGroup>
          <FormGroup>
            <Label for="visibility">Cube visibility</Label>
            <Input
              id="visibility"
              name="visibility"
              type="select"
              value={state.visibility}
              onChange={(e) => {
                setState({ ...state, visibility: e.target.value });
              }}
            >
              <option value="pu">Public</option>
              <option value="un">Unlisted</option>
              <option value="pr">Private</option>
            </Input>
            <FormText>{visibilityHelp[state.visibility]}</FormText>
          </FormGroup>
          <FormGroup>
            <Label for="defaultStatus">Default status</Label>
            <Input
              id="defaultStatus"
              name="defaultStatus"
              type="select"
              value={state.defaultStatus}
              onChange={(e) => {
                setState({ ...state, defaultStatus: e.target.value });
              }}
            >
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
              value={state.defaultPrinting}
              onChange={(e) => {
                setState({ ...state, defaultPrinting: e.target.value });
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
