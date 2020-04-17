import React from 'react';

import {
  Button,
  Col,
  CustomInput,
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

import Affiliate from 'utils/Affiliate';
import { getLabels } from 'utils/Sort';

import { ColorChecksAddon } from 'components/ColorCheck';
import LoadingButton from 'components/LoadingButton';
import FoilCardImage from 'components/FoilCardImage';
import TagInput from 'components/TagInput';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import withLoading from 'components/WithLoading';

const LoadingCustomInput = withLoading(CustomInput, []);

const CardModal = ({
  card,
  maybe,
  versions,
  versionsLoading,
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
              {Number.isFinite(card.details.price) && (
                <TextBadge name="Price" className="mt-2 mr-2">
                  <Tooltip text="TCGPlayer Market Price">${card.details.price.toFixed(2)}</Tooltip>
                </TextBadge>
              )}
              {Number.isFinite(card.details.price_foil) && (
                <TextBadge name="Foil" className="mt-2 mr-2">
                  <Tooltip text="TCGPlayer Market Price">${card.details.price_foil.toFixed(2)}</Tooltip>
                </TextBadge>
              )}
              {Number.isFinite(card.details.elo) && (
                <TextBadge name="Elo" className="mt-2">
                  {card.details.elo}
                </TextBadge>
              )}
            </Row>
          </Col>
          <Col xs="12" sm="8">
            <h5>Card Attributes</h5>
            <fieldset disabled={disabled}>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Version (Set and #)</InputGroupText>
                </InputGroupAddon>
                <LoadingCustomInput
                  type="select"
                  name="version"
                  id="cardModalVersion"
                  value={values.version}
                  onChange={onChange}
                  loading={versionsLoading}
                  spinnerSize="sm"
                >
                  {versions.map(({ _id, version }) => {
                    return (
                      <option key={_id} value={_id}>
                        {version}
                      </option>
                    );
                  })}
                </LoadingCustomInput>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Status</InputGroupText>
                </InputGroupAddon>
                <CustomInput type="select" name="status" id="cardModalStatus" value={values.status} onChange={onChange}>
                  {getLabels(null, 'Status').map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </CustomInput>
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>Finish</InputGroupText>
                </InputGroupAddon>
                <CustomInput type="select" name="finish" id="cardModalFinish" value={values.finish} onChange={onChange}>
                  {getLabels(null, 'Finish').map((finish) => (
                    <option key={finish}>{finish}</option>
                  ))}
                </CustomInput>
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
                  <InputGroupText>Image URL</InputGroupText>
                </InputGroupAddon>
                <Input type="text" name="imgUrl" value={values.imgUrl} onChange={onChange} />
              </InputGroup>
              <InputGroup className="mb-3">
                <InputGroupText className="square-right">Color</InputGroupText>
                <ColorChecksAddon addonType="append" prefix="color" values={values} onChange={onChange} />
              </InputGroup>

              <h5>Notes</h5>
              <InputGroup className="mb-3">
                <Input type="textarea" name="notes" value={values.notes} onChange={onChange} />
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
        {!disabled && !maybe && (
          <Button color="danger" onClick={queueRemoveCard}>
            <span className="d-none d-sm-inline">Remove from cube</span>
            <span className="d-sm-none">Remove</span>
          </Button>
        )}
        <Button color="secondary" href={card.details.scryfall_uri} target="_blank">
          <span className="d-none d-sm-inline">View on Scryfall</span>
          <span className="d-sm-none">Scryfall</span>
        </Button>
        <Button color="secondary" href={'/tool/card/' + card.cardID} target="_blank">
          <span className="d-none d-sm-inline">View card analytics</span>
          <span className="d-sm-none">Analytics</span>
        </Button>
        <Button color="secondary" href={Affiliate.getTCGLink(card)} target="_blank">
          Buy
        </Button>
        {!disabled && (
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
