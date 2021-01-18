import React, { useContext, useCallback } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Col,
  FormGroup,
  FormText,
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
import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';
import TextEntry from 'components/TextEntry';
import { toNullableInt } from 'utils/Util';

const defaultPack = { filters: [''], trash: 0, sealed: false, picksPerPass: 1, justFirstPass: false };

const changeDescriptionMutation = ({ newFormat, value }) => {
  newFormat.markdown = value;
};

const removePackMutation = ({ newFormat, packIndex }) => {
  if (newFormat.packs.length > 1) newFormat.packs.splice(packIndex, 1);
};

const changeTrashMutation = ({ newFormat, packIndex, value }) => {
  newFormat.packs[packIndex].trash = toNullableInt(value);
};

const changeSealedMutation = ({ newFormat, packIndex, checked }) => {
  newFormat.packs[packIndex].sealed = checked;
};

const changePicksPerPassMutation = ({ newFormat, packIndex, value }) => {
  newFormat.packs[packIndex].picksPerPass = toNullableInt(value);
};

const changeJustFirstPassMutation = ({ newFormat, packIndex, checked }) => {
  newFormat.packs[packIndex].justFirstPass = checked;
};

const changeSlotMutation = ({ newFormat, packIndex, slotIndex, value }) => {
  newFormat.packs[packIndex].filters[slotIndex] = value;
};

const removeSlotMutation = ({ newFormat, packIndex, slotIndex }) => {
  if (newFormat.packs[packIndex].length > 1) newFormat.packs[packIndex].filters.splice(slotIndex, 1);
};

const addSlotMutation = ({ newFormat, packIndex }) => newFormat.packs[packIndex].filters.push('');

const duplicatePackMutation = ({ newFormat, packIndex }) => {
  newFormat.packs.splice(packIndex, 0, newFormat.packs[packIndex]);
};

const addPackMutation = ({ newFormat }) => newFormat.push({ ...defaultPack });

const normalizePackValues = (packs) =>
  packs.map(({ picksPerPass, trash, ...pack }) => ({ ...pack, picksPerPass: picksPerPass ?? 1, trash: trash ?? 0 }));

const CustomDraftFormatModal = ({ isOpen, toggle, formatIndex, format, setFormat }) => {
  const useMutateFormat = (mutation) =>
    useCallback(
      (event) => {
        const { target } = event;
        if (target) {
          const { checked, value } = target;
          const packIndex = toNullableInt(target.getAttribute('data-pack-index'));
          const slotIndex = toNullableInt(target.getAttribute('data-slot-index'));
          const intValue = toNullableInt(value);

          setFormat((oldFormat) => {
            const newFormat = { ...oldFormat, packs: [...(oldFormat.packs ?? [{ ...defaultPack }])] };
            if (packIndex || packIndex === 0) {
              if (
                oldFormat.packs.length <= packIndex ||
                ((slotIndex || slotIndex === 0) && oldFormat.packs[packIndex].filters.length <= slotIndex)
              ) {
                return oldFormat;
              }
              newFormat.packs[packIndex] = {
                ...newFormat.packs[packIndex],
                filters: [...(newFormat.packs[packIndex].filters ?? [''])],
              };
            }
            mutation({ newFormat, value, packIndex, slotIndex, checked, intValue });
            console.log(newFormat);
            return newFormat;
          });
        }
      },
      // eslint-disable-next-line
      [setFormat, mutation],
    );
  const { cubeID } = useContext(CubeContext);

  const changeDescription = useMutateFormat(changeDescriptionMutation);
  const removePack = useMutateFormat(removePackMutation);
  const changeTrash = useMutateFormat(changeTrashMutation);
  const changeSealed = useMutateFormat(changeSealedMutation);
  const changePicksPerPass = useMutateFormat(changePicksPerPassMutation);
  const changeJustFirstPass = useMutateFormat(changeJustFirstPassMutation);
  const changeSlot = useMutateFormat(changeSlotMutation);
  const removeSlot = useMutateFormat(removeSlotMutation);
  const addSlot = useMutateFormat(addSlotMutation);
  const duplicatePack = useMutateFormat(duplicatePackMutation);
  const addPack = useMutateFormat(addPackMutation);

  const packs = format.packs || [{ ...defaultPack }];
  const description = format.markdown || format.html || '';

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="customDraftFormatTitle" size="lg">
      <CSRFForm method="POST" action={`/cube/format/add/${cubeID}`}>
        <ModalHeader id="customDraftFormatTitle" toggle={toggle}>
          Create Custom Draft Format
        </ModalHeader>
        <ModalBody>
          <Row>
            <Col className="mt-2">
              <Input type="text" maxLength="200" name="title" placeholder="Title" defaultValue={format.title} />
            </Col>
            <Col>
              <FormGroup tag="fieldset">
                <FormGroup check>
                  <Label check>
                    <Input type="radio" name="multiples" value="false" defaultChecked={!format.multiples} /> Don't allow
                    more than one of each card in draft
                  </Label>
                </FormGroup>
                <FormGroup check>
                  <Label check>
                    <Input type="radio" name="multiples" value="true" defaultChecked={format.multiples} /> Allow
                    multiples (e.g. set draft)
                  </Label>
                </FormGroup>
              </FormGroup>
            </Col>
          </Row>
          <h6>Description</h6>
          <TextEntry name="markdown" value={description || ''} onChange={changeDescription} maxLength={5000} />
          <FormText>
            Having trouble formatting your posts? Check out the{' '}
            <a href="/markdown" target="_blank">
              markdown guide
            </a>
            .
          </FormText>
          <FormText className="mt-3 mb-1">
            Card values can either be single tags or filter parameters or a comma separated list to create a ratio (e.g.
            3:1 rare to mythic could be <code>rarity:rare, rarity:rare, rarity:rare, rarity:mythic</code>). Tags can be
            specified <code>tag:yourtagname</code> or simply <code>yourtagname</code>. <code>*</code> can be used to
            match any card.
          </FormText>
          {packs.map((pack, packIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <Card key={packIndex} className="mb-3">
              <CardHeader>
                <CardTitle className="mb-0">
                  Pack {packIndex + 1} - {pack.length} Cards
                  <Button close onClick={removePack} data-pack-index={packIndex} />
                </CardTitle>
              </CardHeader>
              <CardBody>
                <FormGroup inline check className="mb-3">
                  <Label>
                    Discard the last
                    <Input
                      type="number"
                      bsSize="sm"
                      className="mr-2 ml-2"
                      value={pack.trash ?? ''}
                      min={0}
                      max={pack.filters.length - 1}
                      onChange={changeTrash}
                      data-pack-index={packIndex}
                    />
                    cards left in each pack.
                  </Label>
                  <Label className="ml-4">
                    <Input type="checkbox" checked={pack.sealed} onChange={changeSealed} data-pack-index={packIndex} />
                    Is a sealed pack.
                  </Label>
                </FormGroup>
                <FormGroup check inline className="mb-3">
                  <Label>
                    Pick
                    <Input
                      type="number"
                      bsSize="sm"
                      className="mr-2 ml-2"
                      value={pack.picksPerPass ?? ''}
                      min={1}
                      max={pack.filters.length}
                      onChange={changePicksPerPass}
                      data-pack-index={packIndex}
                    />
                    cards at a time.
                    <Input
                      className="ml-2"
                      type="checkbox"
                      checked={pack.justFirstPass}
                      onChange={changeJustFirstPass}
                      data-pack-index={packIndex}
                    />
                    Just for the first pass after opening the pack.
                  </Label>
                </FormGroup>
                {pack.filters.map((filter, slotIndex) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <InputGroup key={slotIndex} className={slotIndex !== 0 ? 'mt-3' : undefined}>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>{slotIndex + 1}</InputGroupText>
                    </InputGroupAddon>
                    <Input
                      type="text"
                      value={filter}
                      onChange={changeSlot}
                      data-pack-index={packIndex}
                      data-slot-index={slotIndex}
                    />
                    {pack.filters.length > 0 && (
                      <InputGroupAddon addonType="append">
                        <Button
                          color="secondary"
                          outline
                          onClick={removeSlot}
                          data-pack-index={packIndex}
                          data-slot-index={slotIndex}
                        >
                          Remove
                        </Button>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                ))}
              </CardBody>
              <CardFooter>
                <Button className="mr-2" color="success" onClick={addSlot} data-pack-index={packIndex}>
                  Add Card Slot
                </Button>
                <Button color="success" onClick={duplicatePack} data-pack-index={packIndex}>
                  Duplicate Pack
                </Button>
              </CardFooter>
            </Card>
          ))}
          <Button color="success" onClick={addPack}>
            Add Pack
          </Button>
        </ModalBody>
        <ModalFooter>
          <Input type="hidden" name="format" value={JSON.stringify(normalizePackValues(packs))} />
          <Input type="hidden" name="id" value={formatIndex} />
          <Button color="success" type="submit">
            Save
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

CustomDraftFormatModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  formatIndex: PropTypes.number.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  format: PropTypes.object.isRequired,
  setFormat: PropTypes.func.isRequired,
};

export default CustomDraftFormatModal;
