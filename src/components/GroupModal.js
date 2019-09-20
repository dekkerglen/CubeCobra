import React, { Component } from 'react';

import {
  Button,
  Row, Col,
  Form, FormGroup, Input, Label,
  InputGroup, InputGroupAddon, InputGroupText,
  ListGroup, ListGroupItem,
  Modal, ModalBody, ModalFooter, ModalHeader,
} from 'reactstrap';

import AutocardListItem from './AutocardListItem';
import ColorCheck from './ColorCheck';
import GroupModalContext from './GroupModalContext';
import TagInput from './TagInput';

class GroupModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      cards: [],
      status: '',
      cmc: '',
      type_line: '',
      tags: [],
    };

    for (const color of [...'WUBRGC']) {
      this.state[`color${color}`] = false;
    }

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleRemoveCard = this.handleRemoveCard.bind(this);
    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.reorderTag = this.reorderTag.bind(this);

    this.tagActions = {
      addTag: this.addTag,
      deleteTag: this.deleteTag,
      reorderTag: this.reorderTag,
    };
  }

  open(cards) {
    this.setState({
      isOpen: true,
      cards,
    });
  }

  close() {
    this.setState({ isOpen: false });
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
    });
  }

  handleRemoveCard(event) {
    const target = event.currentTarget;
    const index = target.getAttribute('data-index');
    console.log('handle', target);
    this.setState(({ cards }) => ({
      cards: cards.filter(c => c.index !== parseInt(index)),
    }));
  }

  addTag(tag) {
    this.setState(({ tags }) => ({
      tags: [...tags, tag],
    }));
  }

  deleteTag(tagIndex) {
    this.setState(({ tags }) => ({
      tags: tags.filter((tag, i) => i !== tagIndex),
    }));
  }

  reorderTag(tag, currIndex, newIndex) {
    this.setState(({ tags }) => {
      const copy = [...tags];
      copy.splice(currIndex, 1);
      copy.splice(newIndex, 0, tag);
      return { tags: copy };
    });
  }

  render() {
    const { canEdit, children, ...props } = this.props;
    const { isOpen, cards, status, cmc, type_line, addTags, deleteTags, tags } = this.state;

    if (!canEdit) {
      return <>{children}</>;
    }

    const checkColors = [['White', 'W'], ['Blue', 'U'], ['Black', 'B'], ['Red', 'R'], ['Green', 'G'], ['Colorless', 'C']];
    return <>
      <GroupModalContext.Provider value={{ openGroupModal: this.open }}>
        {children}
      </GroupModalContext.Provider>
      <Modal size="lg" isOpen={isOpen} toggle={this.close} {...props}>
        <ModalHeader toggle={this.close}>Edit Selected</ModalHeader>
        <ModalBody>
          <Row>
            <Col xs="4">
              <ListGroup className="list-outline">
                {cards.map(card =>
                  <AutocardListItem key={card.index} card={card} noCardModal>
                    <Button close className="float-none mr-1" data-index={card.index} onClick={this.handleRemoveCard} />
                  </AutocardListItem>
                )}
              </ListGroup>
            </Col>
            <Col xs="8">
              <Form>
                <Label for="groupStatus">
                  <h5>Set Status of All</h5>
                </Label>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Status</InputGroupText>
                  </InputGroupAddon>
                  <Input type="select" id="groupStatus" name="status" value={status} onChange={this.handleChange} >
                    {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned'].map(status =>
                      <option key={status}>{status}</option>
                    )}
                  </Input>
                </InputGroup>

                <h5>Override Attribute on All</h5>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>CMC</InputGroupText>
                  </InputGroupAddon>
                  <Input type="text" name="cmc" value={cmc} onChange={this.handleChange} />
                </InputGroup>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Type</InputGroupText>
                  </InputGroupAddon>
                  <Input type="text" name="type_line" value={type_line} onChange={this.handleChange} />
                </InputGroup>

                <h5>Color Identity Override</h5>
                <div>
                  {checkColors.map(color =>
                    <ColorCheck
                      key={color[1]}
                      color={color[0]}
                      short={color[1]}
                      value={this.state['color' + color[1]]}
                      onChange={this.handleChange}
                    />
                  )}
                </div>
                <p><em>
                  Selecting no mana symbols will cause the selected cards' color identity to remain unchanged.
                  Selecting only colorless will cause the selected cards' color identity to be set to colorless.
                </em></p>
                <h5>Edit Tags</h5>
                <FormGroup tag="fieldset">
                  <FormGroup check>
                    <Label check>
                      <Input type="radio" name="addTags" value={addTags} onChange={this.handleChange} />{' '}
                      Add tags to all
                    </Label>
                  </FormGroup>
                  <FormGroup check>
                    <Label check>
                      <Input type="radio" name="deleteTags" value={deleteTags} onChange={this.handleChange} />{' '}
                      Delete tags from all
                    </Label>
                  </FormGroup>
                </FormGroup>
                <TagInput tags={tags} {...this.tagActions} />
              </Form>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="danger">Remove all from cube</Button>
          <Button color="secondary">Buy all</Button>
          <Button color="success">Apply to all</Button>
        </ModalFooter>
      </Modal>
    </>;
  }
}

export default GroupModal;
