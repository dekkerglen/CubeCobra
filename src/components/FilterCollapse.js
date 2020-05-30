import React, { Component } from 'react';

import {
  Button,
  Col,
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

import { makeFilter } from 'filtering/FilterCards';
import Query from 'utils/Query';
import { fromEntries } from 'utils/Util';

import { ColorChecksAddon, ColorChecksControl } from 'components/ColorCheck';
import LoadingButton from 'components/LoadingButton';

import TextField from 'components/TextField';
import NumericField from 'components/NumericField';

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
        <Row className="row-mid-padding">
          <Col md={6}>
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
          </Col>
          <Col md={6}>
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
          </Col>
        </Row>
        <Row className="row-mid-padding">
          <Col md={6}>
            <NumericField
              name="price"
              humanName="Price"
              placeholder={'Any decimal number, e.g. "3.50"'}
              value={values.price}
              onChange={onChange}
            />
          </Col>
          <Col md={6}>
            <NumericField
              name="priceFoil"
              humanName="Foil Price"
              placeholder={'Any decimal number, e.g. "14.00"'}
              value={values.priceFoil}
              onChange={onChange}
            />
          </Col>
        </Row>
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
      typeQuick: '',
      cmcQuick: '',
      cmcQuickOp: '<=',
      textQuick: '',
      ...fromEntries(colorFields.map((n) => [...'WUBRG'].map((c) => [n + c, false])).flat()),
    };

    this.toggleAdvanced = this.toggleAdvanced.bind(this);
    this.applyAdvanced = this.applyAdvanced.bind(this);
    this.applyQuick = this.applyQuick.bind(this);
    this.updateFilters = this.updateFilters.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleApply = this.handleApply.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleReset = this.handleReset.bind(this);

    if (this.props.defaultFilterText) this.updateFilters();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.filter !== this.props.filter) {
      const { filterInput } = this.state;
      if (filterInput === '') {
        Query.del('f');
      } else {
        Query.set('f', filterInput);
      }
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
        let value = this.state[name].replace('"', '\\"');
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

  async applyQuick(event) {
    const tokens = [];
    for (const name of ['type', 'text']) {
      let value = this.state[`${name}Quick`];
      if (!value) continue;
      if (value.includes(' ')) {
        value = value.replace('"', '\\"');
        value = `"${value}"`;
      }
      tokens.push(`${name}:${value}`);
    }

    const colors = [];
    for (const color of [...'WUBRGC']) {
      if (this.state[`colorQuick${color}`]) {
        colors.push(color);
      }
    }
    if (colors.length > 0) {
      tokens.push(`coloridentity=${colors.join('')}`);
    }

    if (this.state.cmcQuick) {
      tokens.push(`cmc${this.state.cmcQuickOp}${this.state.cmcQuick}`);
    }

    const filterInput = tokens.join(' ');
    this.setState({ filterInput });
    await this.updateFilters(filterInput);
  }

  async updateFilters(overrideFilter) {
    const filterInput = overrideFilter ?? this.state.filterInput;
    if ((filterInput ?? '') === '') {
      this.props.setFilter(null, '');
      return;
    }

    const { filter, err } = makeFilter(filterInput);
    if (err) return;

    // TODO: Copy to advanced filter boxes.
    this.setState({ loading: true });
    await this.props.setFilter(() => filter, filterInput);
    this.setState({ loading: false });
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

  handleReset() {
    this.setState({ filterInput: '' });
    this.props.setFilter(null, '');
  }

  render() {
    const { filter, setFilter, numCards, numShown, useQuery, defaultFilterText, noCount, ...props } = this.props;
    const { loading, filterInput, advancedOpen } = this.state;
    const { err } = makeFilter(filterInput);
    const valid = !err;
    if (err) {
      console.warn(err);
    }
    const appliedText =
      'Filters applied' +
      (typeof numCards !== 'undefined' ? `: ${numCards} cards` : '') +
      (typeof numShown !== 'undefined' ? `, ${numShown} shown` : '') +
      '.';
    return (
      <Collapse className="px-3" {...props}>
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
                  disabled={loading}
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
          </Col>
        </Row>
        <Row style={{ margin: '0 -5px' }}>
          <Col xs="auto" style={{ padding: '0 5px' }}>
            <ColorChecksControl
              size="sm"
              className="mb-3"
              colorless
              prefix="colorQuick"
              values={this.state}
              onChange={this.handleChange}
            />
          </Col>
          <Col xs="auto" style={{ padding: '0 5px' }}>
            <InputGroup size="sm" className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText htmlFor="typeQuick">Type</InputGroupText>
              </InputGroupAddon>
              <Input
                name="typeQuick"
                id="typeQuick"
                value={this.state.typeQuick}
                onChange={this.handleChange}
                style={{ width: '8rem' }}
              />
            </InputGroup>
          </Col>
          <Col xs="auto" style={{ padding: '0 5px' }}>
            <InputGroup size="sm" className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText htmlFor="cmcQuick">CMC</InputGroupText>
              </InputGroupAddon>
              <CustomInput
                type="select"
                name="cmcQuickOp"
                value={this.state.cmcQuickOp}
                onChange={this.handleChange}
                bsSize="sm"
                style={{ textAlignLast: 'center', maxWidth: '3.5rem' }}
              >
                <option>{'>'}</option>
                <option>{'>='}</option>
                <option>{'='}</option>
                <option>{'<='}</option>
                <option>{'<'}</option>
              </CustomInput>
              <InputGroupAddon addonType="append">
                <Input
                  name="cmcQuick"
                  id="cmcQuick"
                  value={this.state.cmcQuick}
                  onChange={this.handleChange}
                  size="sm"
                  className="square-left"
                  style={{ width: '3rem' }}
                />
              </InputGroupAddon>
            </InputGroup>
          </Col>
          <Col xs="auto" style={{ padding: '0 5px' }}>
            <InputGroup size="sm" className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText htmlFor="textQuick">Text</InputGroupText>
              </InputGroupAddon>
              <Input
                name="textQuick"
                id="textQuick"
                value={this.state.textQuick}
                onChange={this.handleChange}
                style={{ width: '8rem' }}
              />
            </InputGroup>
          </Col>
          <Col xs="auto" style={{ padding: '0 5px' }}>
            <Button onClick={this.applyQuick} size="sm" color="primary">
              Quick Filter
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            {!noCount && (
              <p>{!filter || filter.length === 0 ? <em>No filters applied.</em> : <em>{appliedText}</em>}</p>
            )}
          </Col>
        </Row>
        <Row>
          <Col>
            <Button color="success" className="mr-2 mb-3" onClick={this.handleReset}>
              Reset Filters
            </Button>
            <Button color="success" className="mr-2 mb-3" onClick={this.toggleAdvanced}>
              Advanced...
            </Button>
            <Button color="success" className="mr-2 mb-3" href="/filters">
              Syntax Guide
            </Button>
          </Col>
        </Row>
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
