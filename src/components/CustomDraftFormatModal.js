import React, { useContext, useCallback, useRef } from 'react';

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
  Right,
  Row,
} from 'reactstrap';

import CSRFForm from './CSRFForm';
import CubeContext from './CubeContext';
import TextEntry from './TextEntry';

const CustomDraftFormatModal = ({ isOpen, toggle, formatIndex, format, setFormat }) => {
  const { cubeID } = useContext(CubeContext);

  const formRef = useRef();
  const defaultPack = { filters: [''], trash: 0, sealed: false };

  const handleChangeDescription = useCallback((event) => {
    setFormat((format) => ({
      ...format,
      html: event.target.value,
    }));
  });

  const handleAddCard = useCallback((event) => {
    const index = parseInt(event.currentTarget.getAttribute('data-index'));
    setFormat((format) => {
      const newFormat = { ...format };
      newFormat.packs = [...(newFormat.packs ?? [{ ...defaultPack }])];
      newFormat.packs[index] = { ...newFormat.packs[index] };
      newFormat.packs[index].filters = [...newFormat.packs[index].filters, ''];
      return newFormat;
    });
  }, []);
  const handleRemoveCard = useCallback((event) => {
    const packIndex = parseInt(event.currentTarget.getAttribute('data-pack'));
    const index = parseInt(event.currentTarget.getAttribute('data-index'));
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
  }, []);
  const handleChangeCard = useCallback(() => {
    const packIndex = parseInt(event.target.getAttribute('data-pack'));
    const index = parseInt(event.target.getAttribute('data-index'));
    const value = event.target.value;
    setFormat((format) => {
      const newFormat = { ...format };
      newFormat.packs = [...(newFormat.packs || [{ ...defaultPack }])];
      newFormat.packs[packIndex] = { ...newFormat.packs[packIndex] };
      newFormat.packs[packIndex].filters = [...newFormat.packs[packIndex].filters];
      newFormat.packs[packIndex].filters[index] = value;
      return newFormat;
    });
  }, []);
  const handleAddPack = useCallback(() => {
    setFormat(({ packs, ...format }) => ({
      ...format,
      packs: [...(packs || [{ ...defaultPack }]), { ...defaultPack }],
    }));
  }, []);
  const handleDuplicatePack = useCallback((event) => {
    const index = parseInt(event.currentTarget.getAttribute('data-index'));
    setFormat((format) => {
      const newFormat = { ...format };
      newFormat.packs = [...(newFormat.packs || [['']])];
      newFormat.packs.splice(index, 0, newFormat.packs[index]);
      return newFormat;
    });
  }, []);
  const handleRemovePack = useCallback((event) => {
    const removeIndex = parseInt(event.currentTarget.getAttribute('data-index'));
    setFormat(({ packs, ...format }) => ({
      ...format,
      packs: (packs || [['']]).filter((_, index) => index !== removeIndex),
    }));
  }, []);
  const handleChangeTrash = useCallback((event) => {
    const packIndex = parseInt(event.target.getAttribute('data-index'), 10);
    const value = parseInt(event.target.value, 10);
    setFormat(({ ...format }) => {
      format.packs = [...(format.packs || [{ ...defaultPack }])];
      format.packs[packIndex].trash = Number.isInteger(value) ? value : 0;
      return format;
    });
  });
  const handleChangeSealed = useCallback((event) => {
    const packIndex = parseInt(event.target.getAttribute('data-index'), 10);
    setFormat(({ ...format }) => {
      format.packs = [...(format.packs || [{ ...defaultPack }])];
      format.packs[packIndex].sealed = !format.packs[packIndex].sealed;
      return format;
    });
  });

  const packs = format.packs || [{ ...defaultPack }];
  const description = format.html || '';

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="customDraftFormatTitle" size="lg">
      <CSRFForm method="POST" action={`/cube/format/add/${cubeID}`} innerRef={formRef}>
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
          <TextEntry name="html" value={description} onChange={handleChangeDescription} />
          <FormText className="mt-3 mb-1">
            Card values can either be single tags or filter parameters or a comma separated list to create a ratio (e.g.
            3:1 rare to mythic could be <code>rarity:rare, rarity:rare, rarity:rare, rarity:mythic</code>). Tags can be
            specified <code>tag:yourtagname</code> or simply <code>yourtagname</code>. <code>*</code> can be used to
            match any card.
          </FormText>
          {packs.map((pack, index) => (
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
                    Discard last
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
                    cards left in the pack during drafting.
                  </Label>
                  <Label className="ml-4">
                    <Input type="checkbox" checked={pack.sealed} onClick={handleChangeSealed} data-index={index} />
                    This pack is a sealed pack.
                  </Label>
                </Form>
                {pack.filters.map((card, cardIndex) => (
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

export default CustomDraftFormatModal;
