import React, { Component } from 'react';

import { Button, Col, FormGroup, Input, InputGroup, InputGroupAddon, InputGroupText, Label, Modal, ModalBody, ModalHeader, Row } from 'reactstrap';

class CardModal extends Component {
  constructor(props) {
    this.state = { open: false };
  }

  toggle() {
    this.setState(({ open, ...rest }) => {
      return { ...rest, open: !open };
    });
  }

  render({ card }) {
    return (
      <Modal id="contextModal" labelledby="exampleModalCenterTitle">
        <ModalHeader>
          <h5 class="modal-title" id="contextModalTitle">Ambush Viper</h5>
          <Button onClick={this.toggle} close className="ml-auto" />
        </ModalHeader>
        <ModalBody>
          <Row>
            <Col xs="12" sm="4">
              <img class="defaultCardImage" id="contextModalImg" src={card.details.display_image} alt={card.name} />
              <div class="price-area"></div>
            </Col>
            <Col xs="12" sm="8">
              <h5>Card Attributes</h5>
              <InputGroup>
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Version (Set and #)</InputGroupText>
                </InputGroupAddon>
                <Input type="select" id="contextModalVersionSelect">
                </Input>
              </InputGroup>
              <InputGroup>
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Status</InputGroupText>
                </InputGroupAddon>
                <Input type="select" id="contextModalStatusSelect"></Input>
              </InputGroup>
              <InputGroup>
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>CMC</InputGroupText>
                </InputGroupAddon>
                <Input id="contextModalCMC" type="text" value="2" />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Type</InputGroupText>
                </InputGroupAddon>
                <Input id="contextModalType" type="text" value="2" />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Card Image URL</InputGroupText>
                </InputGroupAddon>
                <Input id="contextModalImageURL" type="text" value="2" />
              </InputGroup>

              <h5>Color Identity Override:</h5>
              <FormGroup check>
                <Label check>
                  <Input type="checkbox" id="contextModalCheckboxW" />
                  <img src="/content/symbols/w.png" alt="White" title="White" />
                </Label>
              </FormGroup>
              <FormGroup check>
                <Label check>
                  <Input type="checkbox" id="contextModalCheckboxU" />
                  <img src="/content/symbols/u.png" alt="White" title="White" />
                </Label>
              </FormGroup>
              <FormGroup check>
                <Label check>
                  <Input type="checkbox" id="contextModalCheckboxB" />
                  <img src="/content/symbols/b.png" alt="White" title="White" />
                </Label>
              </FormGroup>
              <FormGroup check>
                <Label check>
                  <Input type="checkbox" id="contextModalCheckboxR" />
                  <img src="/content/symbols/r.png" alt="White" title="White" />
                </Label>
              </FormGroup>
              <FormGroup check>
                <Label check>
                  <Input type="checkbox" id="contextModalCheckboxG" />
                  <img src="/content/symbols/g.png" alt="White" title="White" />
                </Label>
              </FormGroup>

              <h5>Tags</h5>
              <div class="tags-area" id="contextTags">
                <div class="tags-input" data-name="tags-input"><span class="tags"></span><input class="hidden-input" type="hidden" /><input class="main-input" maxlength="24" /></div>
              </div>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <a id="contextScryfallButton" href="#" target="_blank">
            <Button color="secondary">
              <span class="d-none d-sm-inline">View on Scryfall</span>
              <span class="d-sm-none">Scryfall</span>
            </Button>
          </a>
          <a id="contextBuyButton" href="#" target="_blank">
            <Button color="secondary">Buy</Button>
          </a>
        </ModalFooter>
      </Modal>
    );
  }
}

export default CardModal;