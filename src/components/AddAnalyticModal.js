import React, { useCallback, useState } from 'react';

import {
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
} from 'reactstrap';

import AddAnalyticModalContext from './AddAnalyticModalContext';

const AddAnalyticModal = ({ addScript, children, ...props}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    name: 'New Analytic',
    key: 'custom',
    code:
      'onmessage = e => {\n' +
      '  if (!e) return;\n' +
      '  const cards = e.data;\n' +
      '\n' +
      '  // Fill in your code here\n' +
      '\n' +
      '  postMessage({\n' +
      "    type: 'table',\n" +
      '    columns: [\n' +
      "      {header: 'Header', key: 'firstcolumn'}\n" +
      '    ],\n' +
      '    data: [\n' +
      "      {key: 'firstdata', firstcolumn: '{w}'}\n" +
      '    ]\n' +
      '  });\n' +
      '}'
  });

  const handleChange = useCallback((event) => {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    setFormValues((formValues) => ({
      ...formValues,
      [name]: value
    }));
  });

  const submitAnalytic = useCallback(() => {
    addScript(state.name, state.key, state.code);
    setIsOpen(false);  
  });

  const openAddAnalyticModal = useCallback(() => setIsOpen(true));

  const closeAddAnalyticModal = useCallback(() => setIsOpen(false));

  return (
    <AddAnalyticModalContext.Provider value={openAddAnalyticModal}>
      {children}
      <Modal
        size="lg"
        toggle={closeAddAnalyticModal}
        isOpen={isOpen}
        {...props}
      >
        <ModalHeader id="addAnalyticModalHeader" toggle={closeAddAnalyticModal}>
          Add Analytics Script
        </ModalHeader>
        <ModalBody>
          <fieldset>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Analytic Name</InputGroupText>
              </InputGroupAddon>
              <Input type="text" name="name" value={formValues.name} onChange={handleChange} />
            </InputGroup>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Analytic Key</InputGroupText>
              </InputGroupAddon>
              <Input type="text" name="key" value={formValues.key} onChange={handleChange} />
            </InputGroup>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Analytic Script</InputGroupText>
              </InputGroupAddon>
              <Input type="textarea" rows="20" name="code" value={formValues.code} onChange={handleChange} />
            </InputGroup>
          </fieldset>
        </ModalBody>
        <ModalFooter>
          <Button color="success" onClick={submitAnalytic}>
            Add Analytic
          </Button>
          <Button color="secondary" onClick={closeAddAnalyticModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </AddAnalyticModalContext.Provider>
  );
}

export default AddAnalyticModal;
