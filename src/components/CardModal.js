import React from 'react';

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

import ButtonLink from './ButtonLink';
import ColorCheck from './ColorCheck';
import ImageFallback from './ImageFallback';
import TagInput from './TagInput';

import Affiliate from '../util/Affiliate';

const CardModal = ({
  card,
  versions,
  toggle,
  disabled,
  values,
  onChange,
  saveChanges,
  queueRemoveCard,
  tagActions,
  cardFinishActions,
  ...props
}) => {
  return (
    <Modal size="lg" labelledby="cardModalHeader" toggle={toggle} {...props}>
      <ModalHeader id="cardModalHeader" toggle={toggle}>
        {card.details.name}
      </ModalHeader>
      <ModalBody>
        <Row>
          <Col xs="12" sm="4">
            <ImageFallback
              className="w-100"
              src={values.imgUrl || card.details.image_normal}
              fallbackSrc="/content/default_card.png"
              alt={card.name}
              finish={values.finish}
            />
            <div className="price-area">
              {!card.details.price ? (
                ''
              ) : (
                <div className="card-price">
                  TCGPlayer Market:
                  {card.details.price.toFixed(2)}
                </div>
              )}
              {!card.details.price_foil ? (
                ''
              ) : (
                <div className="card-price">
                  Foil TCGPlayer Market:
                  {card.details.price_foil.toFixed(2)}
                </div>
              )}
            </div>
          </Col>
          <Col xs="12" sm="8">
            <h5>Card Attributes</h5>
            <fieldset disabled={disabled}>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Version (Set and #)</InputGroupText>
                </InputGroupAddon>
                <Input
                  type="select"
                  id="cardModalVersionSelect"
                  name="version"
                  value={values.version}
                  onChange={onChange}
                >
                  {versions.map((version) => {
                    const name = version.full_name
                      .toUpperCase()
                      .substring(version.full_name.indexOf('[') + 1, version.full_name.indexOf(']'));
                    return (
                      <option key={version._id} value={version._id}>
                        {name}
                      </option>
                    );
                  })}
                </Input>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Status</InputGroupText>
                </InputGroupAddon>
                <Input type="select" name="status" value={values.status} onChange={onChange}>
                  {getLabels('Status').map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Input>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Finish</InputGroupText>
                </InputGroupAddon>
                <Input type="select" name="finish" value={values.finish} onChange={onChange}>
                  {getLabels('Finish').map((finish) => (
                    <option key={finish}>{finish}</option>
                  ))}
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
                {[['White', 'W'], ['Blue', 'U'], ['Black', 'B'], ['Red', 'R'], ['Green', 'G']].map((color) => (
                  <ColorCheck
                    key={color[1]}
                    color={color[0]}
                    short={color[1]}
                    value={values[`color${color[1]}`]}
                    onChange={onChange}
                  />
                ))}
              </div>

              <h5>Tags</h5>
              <TagInput tags={values.tags} readOnly={disabled} {...tagActions} />
            </fieldset>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        {disabled ? (
          '' // FIXME: This button is still uncontrolled.
        ) : (
          <Button color="danger" onClick={queueRemoveCard}>
            <span className="d-none d-sm-inline">Remove from cube</span>
            <span className="d-sm-none">Remove</span>
          </Button>
        )}
        <ButtonLink color="secondary" href={card.details.scryfall_uri}>
          <span className="d-none d-sm-inline">View on Scryfall</span>
          <span className="d-sm-none">Scryfall</span>
        </ButtonLink>
        <ButtonLink color="secondary" href={Affiliate.getTCGLink(card)}>
          Buy
        </ButtonLink>
        {disabled ? (
          ''
        ) : (
          <Button color="success" onClick={saveChanges}>
            <span className="d-none d-sm-inline">Save changes</span>
            <span className="d-sm-none">Save</span>
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default CardModal;
