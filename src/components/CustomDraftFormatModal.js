import React, { useContext, useCallback } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Col,
  Form,
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

const defaultPack = { filters: [''], trash: 0, sealed: false, picksPerPass: 1 };

const CustomDraftFormatModal = ({ isOpen, toggle, formatIndex, format, setFormat }) => {
  const { cubeID } = useContext(CubeContext);

  const handleChangeDescription = useCallback(
    (event) => {
      const { target } = event;
      if (target) {
        // eslint-disable-next-line no-shadow
        setFormat((format) => ({
          ...format,
          markdown: target.value,
        }));
      }
    },
    [setFormat],
  );

  const handleAddCard = useCallback(
    (event) => {
      const index = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      // eslint-disable-next-line no-shadow
      setFormat((format) => {
        const newFormat = { ...format };
        newFormat.packs = [...(newFormat.packs ?? [{ ...defaultPack }])];
        newFormat.packs[index] = { ...newFormat.packs[index] };
        newFormat.packs[index].filters = [...newFormat.packs[index].filters, ''];
        return newFormat;
      });
    },
    [setFormat],
  );
  const handleRemoveCard = useCallback(
    (event) => {
      const packIndex = parseInt(event.currentTarget.getAttribute('data-pack'), 10);
      const index = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      // eslint-disable-next-line no-shadow
      setFormat((format) => {
        // don't remove the last card from a pack
        if (format.packs[packIndex].length <= 1) return format;
        const newFormat = { ...format };
        newFormat.packs = [...(newFormat.packs || [{ ...defaultPack }])];
        newFormat.packs[packIndex] = { ...newFormat.packs[packIndex] };
        newFormat.packs[packIndex].filters = [...newFormat.packs[packIndex].filters];
        newFormat.packs[packIndex].filters.splice(index, 1);
        return newFormat;
      });
    },
    [setFormat],
  );
  const handleChangeCard = useCallback(() => {
    // eslint-disable-next-line no-restricted-globals
    const packIndex = parseInt(event.target.getAttribute('data-pack'), 10);
    // eslint-disable-next-line no-restricted-globals
    const index = parseInt(event.target.getAttribute('data-index'), 10);
    // eslint-disable-next-line no-restricted-globals
    const { value } = event.target;
    // eslint-disable-next-line no-shadow
    setFormat((format) => {
      const newFormat = { ...format };
      newFormat.packs = [...(newFormat.packs || [{ ...defaultPack }])];
      newFormat.packs[packIndex] = { ...newFormat.packs[packIndex] };
      newFormat.packs[packIndex].filters = [...newFormat.packs[packIndex].filters];
      newFormat.packs[packIndex].filters[index] = value;
      return newFormat;
    });
  }, [setFormat]);
  const handleAddPack = useCallback(() => {
    // eslint-disable-next-line no-shadow
    setFormat(({ packs, ...format }) => ({
      ...format,
      packs: [...(packs || [{ ...defaultPack }]), { ...defaultPack }],
    }));
  }, [setFormat]);
  const handleDuplicatePack = useCallback(
    (event) => {
      // eslint-disable-next-line no-restricted-globals
      const index = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      // eslint-disable-next-line no-shadow
      setFormat((format) => {
        const newFormat = { ...format };
        newFormat.packs = [...(newFormat.packs || [['']])];
        newFormat.packs.splice(index, 0, newFormat.packs[index]);
        return newFormat;
      });
    },
    [setFormat],
  );
  const handleRemovePack = useCallback(
    (event) => {
      // eslint-disable-next-line no-restricted-globals
      const removeIndex = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      // eslint-disable-next-line no-shadow
      setFormat(({ packs, ...format }) => ({
        ...format,
        packs: (packs || [['']]).filter((_, index) => index !== removeIndex),
      }));
    },
    [setFormat],
  );
  const handleChangeTrash = useCallback(
    (event) => {
      const packIndex = parseInt(event.target.getAttribute('data-index'), 10);
      const value = parseInt(event.target.value, 10);
      // eslint-disable-next-line no-shadow
      setFormat(({ ...format }) => {
        format.packs = [...(format.packs || [{ ...defaultPack }])];
        format.packs[packIndex].trash = Number.isInteger(value) ? value : null;
        return format;
      });
    },
    [setFormat],
  );
  const handleChangePickAtTime = useCallback(
    (event) => {
      const packIndex = parseInt(event.target.getAttribute('data-index'), 10);
      const value = parseInt(event.target.value, 10);
      // eslint-disable-next-line no-shadow
      setFormat(({ ...format }) => {
        format.packs = [...(format.packs || [{ ...defaultPack }])];
        format.packs[packIndex].picksPerPass = Number.isInteger(value) ? value : null;
        return format;
      });
    },
    [setFormat],
  );
  const handleChangeSealed = useCallback(
    (event) => {
      const packIndex = parseInt(event.target.getAttribute('data-index'), 10);
      // eslint-disable-next-line no-shadow
      setFormat(({ ...format }) => {
        format.packs = [...(format.packs || [{ ...defaultPack }])];
        format.packs[packIndex].sealed = !format.packs[packIndex].sealed;
        return format;
      });
    },
    [setFormat],
  );

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
          <TextEntry name="markdown" value={description || ''} onChange={handleChangeDescription} maxLength={5000} />
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
          {packs.map((pack, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Card key={index} className="mb-3">
              <CardHeader>
                <CardTitle className="mb-0">
                  Pack {index + 1} - {pack.length} Cards
                  <Button close onClick={handleRemovePack} data-index={index} />
                </CardTitle>
              </CardHeader>
              <CardBody>
                <Form inline className="mb-3">
                  <Label>
                    Discard the last
                    <Input
                      type="number"
                      size="sm"
                      className="mr-2 ml-2"
                      value={pack.trash}
                      min={0}
                      max={pack.filters.length - 1}
                      onChange={handleChangeTrash}
                      data-index={index}
                    />
                    cards left in each pack.
                  </Label>
                  <Label className="ml-4">
                    <Input type="checkbox" checked={pack.sealed} onClick={handleChangeSealed} data-index={index} />
                    Is a sealed pack.
                  </Label>
                </Form>
                <Form inline className="mb-3">
                  <Label>
                    Pick
                    <Input
                      type="number"
                      size="sm"
                      className="mr-2 ml-2"
                      value={pack.picksPerPass}
                      min={1}
                      max={pack.filters.length}
                      onChange={handleChangePickAtTime}
                      data-index={index}
                    />
                    cards at a time.
                  </Label>
                </Form>
                {pack.filters.map((card, cardIndex) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <InputGroup key={cardIndex} className={cardIndex !== 0 ? 'mt-3' : undefined}>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>{cardIndex + 1}</InputGroupText>
                    </InputGroupAddon>
                    <Input
                      type="text"
                      value={card}
                      onChange={handleChangeCard}
                      data-pack={index}
                      data-index={cardIndex}
                    />
                    <InputGroupAddon addonType="append">
                      <Button
                        color="secondary"
                        outline
                        onClick={handleRemoveCard}
                        data-pack={index}
                        data-index={cardIndex}
                      >
                        Remove
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                ))}
              </CardBody>
              <CardFooter>
                <Button className="mr-2" color="success" onClick={handleAddCard} data-index={index}>
                  Add Card Slot
                </Button>
                <Button color="success" onClick={handleDuplicatePack} data-index={index}>
                  Duplicate Pack
                </Button>
              </CardFooter>
            </Card>
          ))}
          <Button color="success" onClick={handleAddPack}>
            Add Pack
          </Button>
        </ModalBody>
        <ModalFooter>
          <Input type="hidden" name="format" value={JSON.stringify(packs)} />
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
