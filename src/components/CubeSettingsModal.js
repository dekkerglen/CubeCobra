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
  const { cube, setCube } = useContext(CubeContext);
  const [visibility, setVisibility] = useState(convertVisibility(cube));
  const formRef = useRef();

  const handleSave = useCallback(async () => {
    const formObject = formDataObject(formRef.current);
    console.log(formObject);
    const response = await postJson(`/cube/api/settings/${cube.Id}`, formObject);
    const json = await response.json();
    // eslint-disable-next-line no-underscore-dangle
    delete formObject._csrf;
    if (response.ok) {
      onCubeUpdate({ ...cube, ...formObject });
      setCube((current) => ({ ...current, ...formObject }));
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
  }, [toggle, addAlert, onCubeUpdate, cube, setCube, formRef]);

  return (
    <Modal isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Edit Settings</ModalHeader>
      <ModalBody>
        <CSRFForm innerRef={formRef}>
          <FormGroup check>
            <Input
              id="PrivatePrices"
              name="PrivatePrices"
              type="checkbox"
              defaultChecked={cube.PriceVisibility === 'pr'}
            />
            <Label for="PrivatePrices">Hide Total Prices</Label>
          </FormGroup>
          <FormGroup check>
            <Input
              id="DisableNotifications"
              name="DisableNotifications"
              type="checkbox"
              defaultChecked={cube.DisableNotifications || false}
            />
            <Label for="DisableNotifications">Disable Draft Notifications</Label>
          </FormGroup>
          <FormGroup>
            <Label for="Visibility">Cube Visibility</Label>
            <Input
              id="Visibility"
              name="Visibility"
              type="select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="pu">Public</option>
              <option value="un">Unlisted</option>
              <option value="pr">Private</option>
            </Input>
            <FormText>{visibilityHelp[visibility]}</FormText>
          </FormGroup>
          <FormGroup>
            <Label for="DefaultStatus">Default Status</Label>
            <Input id="DefaultStatus" name="DefaultStatus" type="select" defaultValue={cube.DefaultStatus || false}>
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
              defaultValue={cube.DefaultPrinting || false}
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
