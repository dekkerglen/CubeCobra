import React, { Component } from 'react';

import {
  Button,
  Col, Container, Row,
  Collapse,
  Form, Input, Label,
  InputGroup, InputGroupAddon,
  InputGroupText,
  Modal, ModalBody, ModalFooter, ModalHeader,
} from 'reactstrap';

import Filter from '../util/Filter';
import Hash from '../util/Hash';
import { fromEntries } from '../util/Util';

import { ColorChecks } from './ColorCheck';

const TextField = ({ name, humanName, placeholder, value, onChange, ...props }) =>
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>;

const NumericField = ({ name, humanName, placeholder, valueOp, value, onChange, ...props }) =>
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="select" name={`${name}Op`} value={valueOp} onChange={onChange}>
      <option value="=">equal to</option>
      <option value="<">less than</option>
      <option value=">">greater than</option>
      <option value="<=">less than or equal to</option>
      <option value=">=">greater than or equal to</option>
      <option value="!">not equal to</option>
    </Input>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>;

const allFields = ['name', 'oracle', 'cmc', 'color', 'colorIdentity', 'mana', 'type', 'set', 'tag', 'status', 'price', 'priceFoil', 'power', 'toughness', 'loyalty', 'rarity'];
const numFields = ['cmc', 'price', 'priceFoil', 'power', 'toughness', 'loyalty', 'rarity'];

const AdvancedFilterModal = ({ isOpen, toggle, apply, values, onChange, ...props }) =>
  <Modal isOpen={isOpen} toggle={toggle} size="lg" {...props}>
    <Form onSubmit={e => { e.preventDefault(); apply(); }}>
      <ModalHeader toggle={toggle}>Advanced Filters</ModalHeader>
      <ModalBody>
        <TextField name="name" humanName="Card Name" placeholder={'Any words in the name, e.g. "Fire"'} value={values.name} onChange={onChange} />
        <TextField name="oracle" humanName="Oracle Text" placeholder={'Any text, e.g. "Draw a card"'} value={values.oracle} onChange={onChange} />
        <NumericField name="cmc" humanName="CMC" placeholder={'Any value, e.g. "2"'} value={values.cmc} onChange={onChange} />
        <hr />
        <h6>Color:</h6>
        <ColorChecks prefix="color" values={values} onChange={onChange} />
        <Input type="select" name="colorOp" value={values.colorOp} onChange={onChange}>
          <option value="=">Exactly these colors</option>
          <option value=">=">Including these colors</option>
          <option value="<=">At most these colors</option>
        </Input>
        <hr />
        <ColorChecks prefix="colorIdentity" values={values} onChange={onChange} />
        <Input type="select" name="colorIdentityOp" value={values.colorIdentityOp} onChange={onChange}>
          <option value="=">Exactly these colors</option>
          <option value=">=">Including these colors</option>
          <option value="<=">At most these colors</option>
        </Input>
        <hr />
        <TextField name="mana" humanName="Mana Cost" placeholder={'Any mana cost, e.g. "{1}{W}"'} value={values.mana} onChange={onChange} />
        <TextField name="type" humanName="Type Line" placeholder={'Choose any card type, supertype, or subtypes to match'} value={values.type_line} onChange={onChange} />
        <TextField name="set" humanName="Set" placeholder={'Any set code, e.g. "WAR"'} value={values.set} onChange={onChange} />
        <TextField name="tag" humanName="Tag" placeholder={'Any text, e.g. "Zombie Testing"'} value={values.tag} onChange={onChange} />
        <InputGroup className="mb-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Status</InputGroupText>
          </InputGroupAddon>
          <Input type="select" name="status" value={values.status} onChange={onChange}>
            {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned'].map(status =>
              <option key={status}>{status}</option>
            )}
          </Input>
        </InputGroup>
        <NumericField name="price" humanName="Price" placeholder={'Any decimal number, e.g. "3.50"'} value={values.price} onChange={onChange} />
        <NumericField name="priceFoil" humanName="Foil Price" placeholder={'Any decimal number, e.g. "14.00"'} value={values.priceFoil} onChange={onChange} />
        <NumericField name="power" humanName="Power" placeholder={'Any value, e.g. "2"'} value={values.power} onChange={onChange} />
        <NumericField name="toughness" humanName="Toughness" placeholder={'Any value, e.g. "2"'} value={values.toughness} onChange={onChange} />
        <NumericField name="loyalty" humanName="Loyalty" placeholder={'Any value, e.g. "3"'} value={values.loyalty} onChange={onChange} />
        <NumericField name="rarity" humanName="Rarity" placeholder={'Any rarity, e.g. "common"'} value={values.rarity} onChange={onChange} />
      </ModalBody>
      <ModalFooter>
        <Button color="danger" aria-label="Close" onClick={toggle}>Cancel</Button>
        <Button color="success" type="submit">Apply</Button>
      </ModalFooter>
    </Form>
  </Modal>;

class FilterCollapse extends Component {
  constructor(props) {
    super(props);

    this.state = {
      advancedOpen: false,
      filterInput: Hash.get('f', ''),
      ...fromEntries(allFields.map(n => [n, ''])),
      ...fromEntries(numFields.map(n => [n + 'Op', '='])),
    };

    this.toggleAdvanced = this.toggleAdvanced.bind(this);
    this.applyAdvanced = this.applyAdvanced.bind(this);
    this.updateFilters = this.updateFilters.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleApply = this.handleApply.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  componentDidMount() {
    this.updateFilters();
  }

  toggleAdvanced() {
    this.setState({
      advancedOpen: !this.state.advancedOpen,
    })
  }

  applyAdvanced() {
    // Advanced Filter change. Render to filter input.
    const tokens = [];
    for (const name of allFields) {
      if (this.state[name]) {
        const op = numFields.includes(name) ? (this.state[name + 'Op'] || '=') : ':';
        tokens.push(name + op + this.state[name]);
      }
    }
    const filterInput = tokens.join(' ');
    this.setState({
      advancedOpen: false,
      filterInput,
    });
    this.updateFilters(filterInput);
  }

  updateFilters(overrideFilter) {
    const filterInput = typeof overrideFilter === 'undefined' ? this.state.filterInput : overrideFilter;
    if (filterInput === '') {
      this.props.setFilter([]);
      return;
    }
    const tokens = [];
    const valid = Filter.tokenizeInput(filterInput, tokens);
    if (!valid || !Filter.verifyTokens(tokens)) return;

    if (tokens.length > 0) {
      const filters = [Filter.parseTokens(tokens)];
      // TODO: Copy to advanced filter boxes.
      this.props.setFilter(filters);
      Hash.set('f', filterInput);
    }
  }

  handleChange(event) {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;
    const extra = {};

    if (name !== 'filterInput') {
      // Advanced Filter change. Render to filter input.
      const newState = { ...this.state, [name]: value };
      const tokens = [];
      for (const name of allFields) {
        if (newState[name]) {
          const op = numFields.includes(name) ? (newState[name + 'Op'] || '=') : ':';
          tokens.push(name + op + newState[name]);
        }
      }
      extra.filterInput = tokens.join(' ');
    }

    this.setState({
      [name]: value,
      ...extra,
    });
  }

  handleApply(event) {
    event.preventDefault();
    this.updateFilters();
  }

  handleKeyDown(event) {
    if (event.keyCode === 13 /* ENTER */) {
      event.preventDefault();
      this.updateFilters();
    }
  }

  handleReset(event) {
    this.setState({ filterInput: '' });
    this.props.setFilter([]);
  }

  render() {
    const { filter, setFilter, numCards, ...props } = this.props;
    const { filterInput, advancedOpen } = this.state;
    const tokens = [];
    const valid = Filter.tokenizeInput(filterInput, tokens);
    return (
      <Collapse {...props}>
        <Container>
          <Row>
            <Col>
              <Form>
                <InputGroup className="mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
                  </InputGroupAddon>
                  <Input
                    type="text"
                    id="filterInput"
                    name="filterInput"
                    placeholder={'name:"Ambush Viper"'}
                    valid={filterInput.length > 0 && valid}
                    invalid={filterInput.length > 0 && !valid}
                    value={this.state.filterInput}
                    onChange={this.handleChange}
                    onKeyDown={this.handleKeyDown}
                  />
                  <InputGroupAddon addonType="append">
                    <Button color="success" onClick={this.handleApply}>Apply</Button>
                  </InputGroupAddon>
                </InputGroup>
              </Form>
              <h5>Filters</h5>
              <p>
                {!filter || filter.length === 0 ? <em>No filters applied.</em> :
                  <em>Filters applied: {numCards} total results.</em>
                }
              </p>
            </Col>
          </Row>
          <Row>
            <Col>
              <Button color="success" className="mr-sm-2 mb-3" onClick={this.handleReset}>
                Reset Filters
              </Button>
              <Button color="success" className="mr-sm-2 mb-3" onClick={this.toggleAdvanced}>
                Advanced...
              </Button>
              <Button color="success" className="mr-sm-2 mb-3" href="/filters">Syntax Guide</Button>
            </Col>
          </Row>
        </Container>
        <AdvancedFilterModal
          isOpen={advancedOpen}
          toggle={this.toggleAdvanced}
          apply={this.applyAdvanced}
          values={this.state}
          onChange={this.handleChange}
        />
      </Collapse>
    );
  }
}

export default FilterCollapse;
