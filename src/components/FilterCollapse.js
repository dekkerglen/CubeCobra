import React, { Component } from 'react';

import {
  Button,
  Col,
  Container,
  Row,
  Collapse,
  CustomInput,
  Form,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap';

import Filter from '../utils/Filter';
import Query from '../utils/Query';
import { fromEntries } from '../utils/Util';

import { ColorChecksAddon } from './ColorCheck';
import LoadingButton from './LoadingButton';

const TextField = ({ name, humanName, placeholder, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

const NumericField = ({ name, humanName, placeholder, valueOp, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <CustomInput type="select" id={`${name}Op`} name={`${name}Op`} value={valueOp} onChange={onChange}>
      <option value="=">equal to</option>
      <option value="<">less than</option>
      <option value=">">greater than</option>
      <option value="<=">less than or equal to</option>
      <option value=">=">greater than or equal to</option>
      <option value="!=">not equal to</option>
    </CustomInput>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

const allFields = [
  'name',
  'oracle',
  'cmc',
  'mana',
  'type',
  'set',
  'tag',
  'status',
  'finish',
  'price',
  'priceFoil',
  'elo',
  'power',
  'toughness',
  'loyalty',
  'rarity',
  'artist',
  'is',
];
const numFields = ['cmc', 'price', 'priceFoil', 'elo', 'power', 'toughness', 'loyalty', 'rarity'];
const colorFields = ['color', 'identity'];

const AdvancedFilterModal = ({ isOpen, toggle, apply, values, onChange, ...props }) => (
  <Modal isOpen={isOpen} toggle={toggle} size="lg" {...props}>
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <ModalHeader toggle={toggle}>Advanced Filters</ModalHeader>
      <ModalBody>
        <TextField
          name="name"
          humanName="Card Name"
          placeholder={'Any words in the name, e.g. "Fire"'}
          value={values.name}
          onChange={onChange}
        />
        <TextField
          name="oracle"
          humanName="Oracle Text"
          placeholder={'Any text, e.g. "Draw a card"'}
          value={values.oracle}
          onChange={onChange}
        />
        <NumericField
          name="cmc"
          humanName="CMC"
          placeholder={'Any value, e.g. "2"'}
          value={values.cmc}
          onChange={onChange}
        />
        <InputGroup className="mb-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Color</InputGroupText>
          </InputGroupAddon>
          <ColorChecksAddon prefix="color" values={values} onChange={onChange} />
          <CustomInput type="select" id="colorOp" name="colorOp" value={values.colorOp} onChange={onChange}>
            <option value="=">Exactly these colors</option>
            <option value=">=">Including these colors</option>
            <option value="<=">At most these colors</option>
          </CustomInput>
        </InputGroup>
        <InputGroup className="mb-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Color Identity</InputGroupText>
          </InputGroupAddon>
          <ColorChecksAddon prefix="identity" values={values} onChange={onChange} />
          <CustomInput type="select" id="identityOp" name="identityOp" value={values.identityOp} onChange={onChange}>
            <option value="=">Exactly these colors</option>
            <option value=">=">Including these colors</option>
            <option value="<=">At most these colors</option>
          </CustomInput>
        </InputGroup>
        <TextField
          name="mana"
          humanName="Mana Cost"
          placeholder={'Any mana cost, e.g. "{1}{W}"'}
          value={values.mana}
          onChange={onChange}
        />
        <InputGroup className="mb-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Manacost Type</InputGroupText>
          </InputGroupAddon>
          <Input type="select" name="is" value={values.is} onChange={onChange}>
            {['', 'Gold', 'Hybrid', 'Phyrexian'].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </Input>
        </InputGroup>
        <TextField
          name="type"
          humanName="Type Line"
          placeholder={'Choose any card type, supertype, or subtypes to match'}
          value={values.type_line}
          onChange={onChange}
        />
        <TextField
          name="set"
          humanName="Set"
          placeholder={'Any set code, e.g. "WAR"'}
          value={values.set}
          onChange={onChange}
        />
        <TextField
          name="tag"
          humanName="Tag"
          placeholder={'Any text, e.g. "Zombie Testing"'}
          value={values.tag}
          onChange={onChange}
        />
        <InputGroup className="mb-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Status</InputGroupText>
          </InputGroupAddon>
          <Input type="select" name="status" value={values.status} onChange={onChange}>
            {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Input>
        </InputGroup>
        <InputGroup className="mb-3">
          <InputGroupAddon addonType="prepend">
            <InputGroupText>Finish</InputGroupText>
          </InputGroupAddon>
          <Input type="select" name="finish" value={values.finish} onChange={onChange}>
            {['', 'Foil', 'Non-foil'].map((finish) => (
              <option key={finish}>{finish}</option>
            ))}
          </Input>
        </InputGroup>
        <NumericField
          name="price"
          humanName="Price"
          placeholder={'Any decimal number, e.g. "3.50"'}
          value={values.price}
          onChange={onChange}
        />
        <NumericField
          name="priceFoil"
          humanName="Foil Price"
          placeholder={'Any decimal number, e.g. "14.00"'}
          value={values.priceFoil}
          onChange={onChange}
        />
        <NumericField
          name="elo"
          humanName="Elo"
          placeholder={'Any integer number, e.g. "1200"'}
          value={values.elo}
          onChange={onChange}
        />
        <NumericField
          name="power"
          humanName="Power"
          placeholder={'Any value, e.g. "2"'}
          value={values.power}
          onChange={onChange}
        />
        <NumericField
          name="toughness"
          humanName="Toughness"
          placeholder={'Any value, e.g. "2"'}
          value={values.toughness}
          onChange={onChange}
        />
        <NumericField
          name="loyalty"
          humanName="Loyalty"
          placeholder={'Any value, e.g. "3"'}
          value={values.loyalty}
          onChange={onChange}
        />
        <NumericField
          name="rarity"
          humanName="Rarity"
          placeholder={'Any rarity, e.g. "common"'}
          value={values.rarity}
          onChange={onChange}
        />
        <TextField
          name="artist"
          humanName="Artist"
          placeholder={'Any text, e.g. "seb"'}
          value={values.artist}
          onChange={onChange}
        />
      </ModalBody>
      <ModalFooter>
        <Button color="danger" aria-label="Close" onClick={toggle}>
          Cancel
        </Button>
        <Button color="success" type="submit">
          Apply
        </Button>
      </ModalFooter>
    </Form>
  </Modal>
);

class FilterCollapse extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      advancedOpen: false,
      filterInput: this.props.defaultFilterText || '',
      ...fromEntries(allFields.map((n) => [n, ''])),
      ...fromEntries(numFields.map((n) => [n + 'Op', '='])),
      ...fromEntries(colorFields.map((n) => [n + 'Op', '='])),
      ...fromEntries(colorFields.map((n) => [...'WUBRG'].map((c) => [n + c, false])).flat()),
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
    const defaultFilter = Query.get('f', '');
    this.setState({ filterInput: defaultFilter });
    this.updateFilters(defaultFilter);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.filter === this.props.filter) {
      Query.set('f', this.state.filterInput);
    }
  }

  toggleAdvanced() {
    this.setState({
      advancedOpen: !this.state.advancedOpen,
    });
  }

  async applyAdvanced() {
    // Advanced Filter change. Render to filter input.
    const tokens = [];
    for (const name of allFields) {
      if (this.state[name]) {
        const op = numFields.includes(name) ? this.state[name + 'Op'] || '=' : ':';
        let value = this.state[name].replace('"', '"');
        if (value.indexOf(' ') > -1) {
          value = `"${value}"`;
        }
        tokens.push(`${name}${op}${value}`);
      }
    }
    for (const name of colorFields) {
      const colors = [];
      const op = this.state[name + 'Op'] || '=';
      for (const color of [...'WUBRG']) {
        if (this.state[name + color]) {
          colors.push(color);
        }
      }
      if (colors.length > 0) {
        tokens.push(`${name}${op}${colors.join('')}`);
      }
    }
    const filterInput = tokens.join(' ');
    this.setState({
      advancedOpen: false,
      filterInput,
    });
    await this.updateFilters(filterInput);
  }

  async updateFilters(overrideFilter) {
    const filterInput = typeof overrideFilter === 'undefined' ? this.state.filterInput : overrideFilter;
    if (filterInput === '') {
      this.props.setFilter([], '');
      Query.del('f');
      return;
    }
    const tokens = [];
    const valid = Filter.tokenizeInput(filterInput, tokens) && Filter.verifyTokens(tokens);
    if (!valid) return;

    if (tokens.length > 0) {
      const filters = [Filter.parseTokens(tokens)];
      // TODO: Copy to advanced filter boxes.
      this.setState({ loading: true });
      await this.props.setFilter(filters, filterInput);
      this.setState({ loading: false });
    }
  }

  handleChange(event) {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
    });
  }

  async handleApply(event) {
    event.preventDefault();
    await this.updateFilters();
  }

  async handleKeyDown(event) {
    if (event.keyCode === 13 /* ENTER */) {
      event.preventDefault();
      await this.updateFilters();
    }
  }

  handleReset(event) {
    this.setState({ filterInput: '' });
    this.props.setFilter([], '');
    Query.del('f');
  }

  render() {
    const { filter, setFilter, numCards, numShown, useQuery, defaultFilterText, ...props } = this.props;
    const { loading, filterInput, advancedOpen } = this.state;
    const tokens = [];
    const valid = Filter.tokenizeInput(filterInput, tokens) && Filter.verifyTokens(tokens);
    const appliedText =
      'Filters applied' +
      (typeof numCards !== 'undefined' ? `: ${numCards} cards` : '') +
      (typeof numShown !== 'undefined' ? `, ${numShown} shown` : '') +
      '.';
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
                    <LoadingButton color="success" className="square-left" onClick={this.handleApply} loading={loading}>
                      Apply
                    </LoadingButton>
                  </InputGroupAddon>
                </InputGroup>
              </Form>
              <h5>Filters</h5>
              <p>{!filter || filter.length === 0 ? <em>No filters applied.</em> : <em>{appliedText}</em>}</p>
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
              <Button color="success" className="mr-sm-2 mb-3" href="/filters">
                Syntax Guide
              </Button>
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
