import React from 'react';

import {
  Button,
  Col,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
} from 'reactstrap';

import Affiliate from '../utils/Affiliate';
import { getLabels } from '../utils/Sort';

import ButtonLink from './ButtonLink';
import { ColorChecksAddon } from './ColorCheck';
import LoadingButton from './LoadingButton';
import FoilCardImage from './FoilCardImage';
import TagInput from './TagInput';
import TextBadge from './TextBadge';

const CardModal = ({
  card,
  versions,
  toggle,
  disabled,
  values,
  onChange,
  saveChanges,
  queueRemoveCard,
  setTagInput,
  addTagText,
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
            <FoilCardImage card={card} finish={values.finish} />
            <Row noGutters className="mb-2">
              {card.details.price && <TextBadge name="Price" className="mt-2 mr-2">${card.details.price.toFixed(2)}</TextBadge>}
              {card.details.price_foil && <TextBadge name="Foil" className="mt-2 mr-2">${card.details.price_foil.toFixed(2)}</TextBadge>}
              {card.details.elo && <TextBadge name="Elo" className="mt-2">{card.details.elo}</TextBadge>}
            </Row>
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
                  {getLabels(null, 'Status').map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Input>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Finish</InputGroupText>
                </InputGroupAddon>
                <Input type="select" name="finish" value={values.finish} onChange={onChange}>
                  {getLabels(null, 'Finish').map((finish) => (
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
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Color Identity Override</InputGroupText>
                </InputGroupAddon>
                <ColorChecksAddon addonType="append" prefix="color" values={values} onChange={onChange} />
              </InputGroup>

              <h5>Tags</h5>
              <TagInput
                tags={values.tags}
                readOnly={disabled}
                inputValue={values.tagInput}
                handleInputChange={setTagInput}
                handleInputBlur={addTagText}
                {...tagActions}
              />
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
        <ButtonLink color="secondary" href={'/tool/card/' + card.cardID}>
          <span className="d-none d-sm-inline">View card analytics</span>
          <span className="d-sm-none">Analytics</span>
        </ButtonLink>
        <ButtonLink color="secondary" href={Affiliate.getTCGLink(card)}>
          Buy
        </ButtonLink>
        {disabled ? (
          ''
        ) : (
          <LoadingButton color="success" onClick={saveChanges}>
            <span className="d-none d-sm-inline">Save changes</span>
            <span className="d-sm-none">Save</span>
          </LoadingButton>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default CardModal;
