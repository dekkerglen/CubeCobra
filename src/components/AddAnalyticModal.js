import React, {Component} from 'react';

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

import AddAnalyticModalContext from './AddAnalyticModalContext'

class AddAnalyticModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      name: "New Analytic",
      key: "custom",
      code:   "onmessage = e => {\n"
            + "  if (!e) return;\n"
            + "  const cards = e.data;\n"
            + "\n"
            + "  // Fill in your code here\n"
            + "\n"
            + "  postMessage({\n"
            + "    type: 'table',\n"
            + "    columns: [\n"
            + "      {header: 'Header', key: 'firstcolumn'}\n"
            + "    ],\n"
            + "    data: [\n"
            + "      {key: 'firstdata', firstcolumn: '{w}'}\n"
            + "    ]\n"
            + "  });\n"
            + "}",
        isOpen: false
    };

    this.handleChange = this.handleChange.bind(this);
    this.submitAnalytic = this.submitAnalytic.bind(this);
    this.openAddAnalyticModal = this.openAddAnalyticModal.bind(this);
    this.closeAddAnalyticModal = this.closeAddAnalyticModal.bind(this);
  }
  
  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
        [name]: value,
    });
  }

  submitAnalytic() {
    const {addScript} = this.props;

    this.closeAddAnalyticModal();

    addScript(this.state.name, this.state.key, this.state.code);
  }

  openAddAnalyticModal() {
    this.setState({isOpen: true});
  }

  closeAddAnalyticModal() {
    this.setState({isOpen: false});
  }

  render() {
    let { addScript, setOpenCollapse, children, ...props } = this.props; 
    return (
      <AddAnalyticModalContext.Provider value={this.openAddAnalyticModal}>
        {children}
        <Modal size="lg" labelledby="addAnalyticModalHeader" toggle={this.closeAddAnalyticsModal}
               isOpen={this.state.isOpen} {...props}>
          <ModalHeader id="addAnalyticModalHeader" toggle={this.closeAddAnalyticsModal}>
            Add Analytics Script
          </ModalHeader>
          <ModalBody>
            <fieldset>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Analytic Name</InputGroupText>
                </InputGroupAddon>
                <Input type="text" name="name" value={this.state.name} onChange={this.handleChange} />
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Analytic Key</InputGroupText>
                </InputGroupAddon>
                <Input type="text" name="key" value={this.state.key} onChange={this.handleChange} />
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Analytic Script</InputGroupText>
                </InputGroupAddon>
                <Input type="textarea" rows="20" name="code" value={this.state.code} onChange={this.handleChange} />
              </InputGroup>
            </fieldset>
          </ModalBody>
          <ModalFooter>
            <Button color="success" onClick={this.submitAnalytic}>
              Add Analytic
            </Button>
          </ModalFooter>
        </Modal>
      </AddAnalyticModalContext.Provider>
    );
  }
}

export default AddAnalyticModal;
