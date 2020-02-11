import React, { useCallback, useContext, useRef } from 'react';
import PropTypes from 'prop-types';

import { Button, CustomInput, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import { postJson } from 'utils/CSRF';
import { formDataObject } from 'utils/Form';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'components/CubeContext';
import LoadingButton from 'components/LoadingButton';

const CubeSettingsModal = ({ addAlert, onCubeUpdate, isOpen, toggle }) => {
  const { cube, cubeID, setCube } = useContext(CubeContext);
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
            <Input id="isListed" name="isListed" type="checkbox" defaultChecked={cube.isListed || false} />
            <Label for="isListed">Is Listed</Label>
          </FormGroup>
          <FormGroup check>
            <Input
              id="privatePrices"
              name="privatePrices"
              type="checkbox"
              defaultChecked={cube.privatePrices || false}
            />
            <Label for="privatePrices">Hide Total Prices</Label>
          </FormGroup>
          <FormGroup>
            <Label for="defaultStatus">Default Status</Label>
            <CustomInput
              id="defaultStatus"
              name="defaultStatus"
              type="select"
              defaultValue={cube.defaultStatus || false}
            >
              {['Owned', 'Not Owned'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </CustomInput>
          </FormGroup>
          <FormGroup>
            <Label for="defaultPrinting">Default Printing</Label>
            <CustomInput
              id="defaultPrinting"
              name="defaultPrinting"
              type="select"
              defaultValue={cube.defaultPrinting || false}
            >
              <option value="recent">Most Recent</option>
              <option value="first">First</option>
            </CustomInput>
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
