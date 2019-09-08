import React from 'react';

import { Button, Col, Form, FormGroup, Input, InputGroup, InputGroupAddon, InputGroupText, Label, Modal, ModalBody, ModalFooter, ModalHeader, Row } from 'reactstrap';

import ButtonLink from './ButtonLink';

const ColorCheck = ({ color, short, value, onChange }) => (
  <FormGroup check inline>
    <Label check>
      <Input
        type="checkbox"
        id={`contextModalCheckbox${short.toUpperCase()}`}
        name={`color${short.toUpperCase()}`}
        checked={value}
        onChange={onChange}
      />
      <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} />
    </Label>
  </FormGroup>
);

const CardModal = ({ card, versions, toggle, disabled, values, onChange, saveChanges, ...props }) => {
  let tcgplayerLink = 'https://shop.tcgplayer.com/';
  if (card.details.tcgplayer_id) {
    tcgplayerLink += `product/productsearch?id=${card.details.tcgplayer_id}`;
  } else {
    tcgplayerLink += `productcatalog/product/show?ProductName=${card.details.name}`;
  }
  tcgplayerLink += '&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra';
  return (
    <Modal size="lg" labelledby="cardModalHeader" toggle={toggle} {...props}>
      <ModalHeader id="cardModalHeader" toggle={toggle}>
        {card.details.name}
      </ModalHeader>
      <ModalBody>
        <Row>
          <Col xs="12" sm="4">
            <img className="w-100" src={card.imgUrl || card.details.image_normal} alt={card.name} />
            <div className="price-area">
              {!card.price ? '' :
                <div className="card-price">
                  TCGPlayer Market: {card.price.toFixed(2)}
                </div>
              }
              {!card.price_foil ? '' :
                <div className="card-price">
                  Foil TCGPlayer Market: {card.price_foil.toFixed(2)}
                </div>
              }
            </div>
          </Col>
          <Col xs="12" sm="8">
            <h5>Card Attributes</h5>
            <fieldset disabled={disabled}>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Version (Set and #)</InputGroupText>
                </InputGroupAddon>
                <Input type="select" id="cardModalVersionSelect" name="version" value={values.version} onChange={onChange}>
                  {
                    versions.map(version => {
                      let name = version.full_name.toUpperCase().substring(version.full_name.indexOf('[') + 1, version.full_name.indexOf(']'));
                      return <option key={version._id} value={version._id}>{name}</option>;
                    })
                  }
                </Input>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Status</InputGroupText>
                </InputGroupAddon>
                <Input type="select" name="status" value={values.status} onChange={onChange}>
                  {
                    getLabels('Status').map(status =>
                      <option key={status}>{status}</option>
                    )
                  }
                </Input>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>CMC</InputGroupText>
                </InputGroupAddon>
                <Input type="text" name="cmc" value={values.cmc} onChange={onChange} />
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Type</InputGroupText>
                </InputGroupAddon>
                <Input type="text" name="type_line" value={values.type_line} onChange={onChange} />
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Card Image URL</InputGroupText>
                </InputGroupAddon>
                <Input type="text" name="imgUrl" value={values.imgUrl} onChange={onChange} />
              </InputGroup>

              <h5>Color Identity Override</h5>
              <div className="mb-3">
                {
                  [['White', 'W'], ['Blue', 'U'], ['Black', 'B'], ['Red', 'R'], ['Green', 'G']].map(color =>
                    <ColorCheck
                      key={color[1]}
                      color={color[0]}
                      short={color[1]}
                      value={values['color' + color[1]]}
                      onChange={onChange}
                    />
                  )
                }
              </div>

              <h5>Tags</h5>
              <div className="tags-area" id="contextTags">
                <div className="tags-input" data-name="tags-input">
                  <span className="tags"></span>
                  <input type="hidden" />
                  <input className="main-input" maxLength="24" />
                </div>
              </div>
            </fieldset>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        {disabled ? '' :
          <Button color="danger">
            <span className="d-none d-sm-inline">Remove from cube</span>
            <span className="d-sm-none">Remove</span>
          </Button>
        }
        <ButtonLink color="secondary" href={card.details.scryfall_url}>
          <span className="d-none d-sm-inline">View on Scryfall</span>
          <span className="d-sm-none">Scryfall</span>
        </ButtonLink>
        <ButtonLink color="secondary" href={tcgplayerLink}>
          Buy
        </ButtonLink>
        {disabled ? '' :
          <Button color="success" onClick={saveChanges}>
            <span className="d-none d-sm-inline">Save changes</span>
            <span className="d-sm-none">Save</span>
          </Button>
        }
      </ModalFooter>
    </Modal>
  );
}

export default CardModal;
