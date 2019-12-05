import React, { Component } from 'react';

import {
  Button,
  Row,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  ListGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  UncontrolledAlert,
} from 'reactstrap';

import { csrfFetch } from '../util/CSRF';
import { fromEntries } from '../util/Util';

import AutocardListItem from './AutocardListItem';
import ColorCheck from './ColorCheck';
import GroupModalContext from './GroupModalContext';
import MassBuyButton from './MassBuyButton';
import TagInput from './TagInput';

class GroupModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      cards: [],
      alerts: [],
      status: '',
      cmc: '',
      type_line: '',
      ...fromEntries([...'WUBRGC'].map((c) => [`color${c}`, false])),
      addTags: true,
      deleteTags: false,
      tags: [],
      finish: 'Non-foil',
    };

    this.open = this.open.bind(this);
    this.setCards = this.setCards.bind(this);
    this.close = this.close.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleRemoveCard = this.handleRemoveCard.bind(this);
    this.addTag = this.addTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.reorderTag = this.reorderTag.bind(this);
    this.handleApply = this.handleApply.bind(this);
    this.handleRemoveAll = this.handleRemoveAll.bind(this);

    this.tagActions = {
      addTag: this.addTag,
      deleteTag: this.deleteTag,
      reorderTag: this.reorderTag,
    };
  }

  open() {
    this.setState({
      isOpen: true,
      status: '',
      cmc: '',
      type_line: '',
      ...fromEntries([...'WUBRGC'].map((c) => [`color${c}`, false])),
      addTags: true,
      deleteTags: false,
      tags: [],
    });
  }

  setCards(cards) {
    this.setState({ cards });
  }

  close() {
    this.setState({ isOpen: false });
  }

  error(message) {
    this.setState(({ alerts }) => ({
      alerts: [
        ...alerts,
        {
          color: 'danger',
          message,
        },
      ],
    }));
  }

  handleChange(event) {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;
    const extra = {};
    if (name === 'addTags') {
      extra.deleteTags = false;
    }
    if (name === 'deleteTags') {
      extra.addTags = false;
    }

    this.setState({
      [name]: value,
      ...extra,
    });
  }

  handleRemoveCard(event) {
    const target = event.currentTarget;
    const index = target.getAttribute('data-index');
    console.log('handle', target);
    this.setState(({ cards }) => ({
      cards: cards.filter((c) => c.index !== parseInt(index)),
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

  async handleApply(event) {
    event.preventDefault();
    const { cards, status, cmc, type_line, colorC, addTags, deleteTags } = this.state;
    const { cubeID } = this.props;
    const tags = this.state.tags.map((tag) => tag.text);

    const selected = cards.map((card) => ({ index: card.index }));
    const colors = [...'WUBRG'].filter((color) => this.state[`color${color}`]);
    const updated = {
      status: status || undefined,
      cmc: parseInt(cmc) || undefined,
      type_line: type_line || undefined,
      colors: colors.length > 0 ? colors : undefined,
      colorC: colorC || undefined,
      tags: tags || undefined,
      addTags,
      deleteTags,
    };
    const response = await csrfFetch(`/cube/api/updatecards/${cubeID}`, {
      method: 'POST',
      body: JSON.stringify({ selected, updated }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch((err) => this.error(err));
    const json = await response.json().catch((err) => this.error(err));
    if (json.success === 'true') {
      // Make shallow copy of each card.
      const updatedCards = cards.map((card) => ({ ...card }));
      for (const card of updatedCards) {
        if (status) {
          card.status = status;
        }
        if (cmc) {
          card.cmc = cmc;
        }
        if (type_line) {
          card.type_line = type_line;
        }
        if (addTags) {
          card.tags = [...card.tags, ...tags.filter((tag) => !card.tags.includes(tag))];
        }
        if (deleteTags) {
          card.tags = card.tags.filter((tag) => !tags.includes(tag));
        }

        if (colors.length > 0) {
          card.colors = [...colors];
        }
        if (colorC) {
          card.colors = [];
        }
        cube[card.index] = card;
        cubeDict[card.index] = card;
      }
      /* global */ updateCubeList();

      this.close();
    }
  }

  handleRemoveAll(event) {
    event.preventDefault();
    /* global */
    changes = changes.concat(
      this.state.cards.map((card) => ({
        remove: card.details,
      })),
    );
    editListeners.forEach((listener) => listener());
    updateCollapse();
    this.props.setOpenCollapse(() => 'edit');
    this.close();
  }

  render() {
    const { cubeID, canEdit, setOpenCollapse, children, ...props } = this.props;
    const { isOpen, cards, alerts, status, cmc, type_line, addTags, deleteTags, tags } = this.state;
    const tcgplayerMassEntryUrl =
      'https://store.tcgplayer.com/massentry?partner=CubeCobra' +
      '&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra';

    const contextChildren = (
      <GroupModalContext.Provider
        value={{ groupModalCards: cards, openGroupModal: this.open, setGroupModalCards: this.setCards }}
      >
        {children}
      </GroupModalContext.Provider>
    );

    if (!canEdit) {
      return contextChildren;
    }

    const accumulator = (total, card) => total + (card.details.price || 0);
    const accumulatorFoil = (total, card) => total + (card.details.price_foil || 0);
    const totalPrice = cards.length ? cards.reduce(accumulator, 0) : 0;
    const totalPriceFoil = cards.length ? cards.reduce(accumulatorFoil, 0) : 0;

    const checkColors = [
      ['White', 'W'],
      ['Blue', 'U'],
      ['Black', 'B'],
      ['Red', 'R'],
      ['Green', 'G'],
      ['Colorless', 'C'],
    ];
    return (
      <>
        {contextChildren}
        <Modal size="lg" isOpen={isOpen} toggle={this.close} {...props}>
          <ModalHeader toggle={this.close}>Edit Selected</ModalHeader>
          <ModalBody>
            {alerts.map(({ color, message }) => (
              <UncontrolledAlert color={color}>{message}</UncontrolledAlert>
            ))}
            <Row>
              <Col xs="4" style={{ maxHeight: '35rem', overflow: 'scroll' }}>
                <ListGroup className="list-outline">
                  {cards.map((card) => (
                    <AutocardListItem key={card.index} card={card} noCardModal>
                      <Button
                        close
                        className="float-none mr-1"
                        data-index={card.index}
                        onClick={this.handleRemoveCard}
                      />
                    </AutocardListItem>
                  ))}
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
                    <Input type="select" id="groupStatus" name="status" value={status} onChange={this.handleChange}>
                      {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned'].map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </Input>
                  </InputGroup>

                  <h5>Override Attribute on All</h5>
                  <InputGroup className="mb-2">
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
                    {checkColors.map((color) => (
                      <ColorCheck
                        key={color[1]}
                        color={color[0]}
                        short={color[1]}
                        value={this.state['color' + color[1]]}
                        onChange={this.handleChange}
                      />
                    ))}
                  </div>
                  <p>
                    <em>
                      Selecting no mana symbols will cause the selected cards' color identity to remain unchanged.
                      Selecting only colorless will cause the selected cards' color identity to be set to colorless.
                    </em>
                  </p>
                  <h5>Edit Tags</h5>
                  <FormGroup tag="fieldset">
                    <FormGroup check>
                      <Label check>
                        <Input type="radio" name="addTags" checked={addTags} onChange={this.handleChange} /> Add tags to
                        all
                      </Label>
                    </FormGroup>
                    <FormGroup check>
                      <Label check>
                        <Input type="radio" name="deleteTags" checked={deleteTags} onChange={this.handleChange} />{' '}
                        Delete tags from all
                      </Label>
                    </FormGroup>
                  </FormGroup>
                  <TagInput tags={tags} {...this.tagActions} />
                </Form>
              </Col>
            </Row>
            <Row>
              <Col xs="4">
                <div className="card-price">Total Price: ${totalPrice.toFixed(2)}</div>
                <div className="card-price">Total Foil Price: ${totalPriceFoil.toFixed(2)}</div>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" onClick={this.handleRemoveAll}>
              Remove all from cube
            </Button>
            <MassBuyButton cards={cards}>Buy all</MassBuyButton>
            <Button color="success" onClick={this.handleApply}>
              Apply to all
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }
}

export default GroupModal;
