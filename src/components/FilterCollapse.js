import React, { useCallback, useContext, useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Col,
  Row,
  Collapse,
  Form,
  Input,
  InputGroup,
  InputGroupText,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap';

import { makeFilter } from 'filtering/FilterCards';
import Query from 'utils/Query';

import { ColorChecksAddon, ColorChecksControl } from 'components/ColorCheck';

import TextField from 'components/TextField';
import NumericField from 'components/NumericField';
import AutocompleteInput from 'components/AutocompleteInput';
import CubeContext from 'contexts/CubeContext';
import useQueryParam from 'hooks/useQueryParam';

const allFields = [
  'name',
  'oracle',
  'mv',
  'mana',
  'type',
  'set',
  'tag',
  'status',
  'finish',
  'price',
  'priceFoil',
  'priceEur',
  'priceTix',
  'elo',
  'power',
  'toughness',
  'loyalty',
  'rarity',
  'legality',
  'artist',
  'is',
];

const quickFields = ['name', 'oracle', 'mv', 'mana', 'type'];

const numFields = [
  'mv',
  'price',
  'priceFoil',
  'priceEur',
  'priceTix',
  'elo',
  'power',
  'toughness',
  'loyalty',
  'rarity',
  'legality',
];
const colorFields = ['color', 'identity'];

const AdvancedFilterModal = ({ isOpen, toggle, values, updateValue, apply }) => {
  const { cube } = useContext(CubeContext);
  const cubeId = cube ? cube.Id : null;
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
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
            onChange={(event) => updateValue(event.target.value, 'name')}
          />
          <TextField
            name="oracle"
            humanName="Oracle Text"
            placeholder={'Any text, e.g. "Draw a card"'}
            value={values.oracle}
            onChange={(event) => updateValue(event.target.value, 'oracle')}
          />
          <NumericField
            name="mv"
            humanName="Mana Value"
            placeholder={'Any value, e.g. "2"'}
            value={values.cmc}
            operator={values.cmcOp}
            setValue={(value) => updateValue(value, 'cmc')}
            setOperator={(operator) => updateValue(operator, 'cmcOp')}
          />
          <InputGroup className="mb-3">
            <InputGroupText>Color</InputGroupText>
            <ColorChecksAddon
              colorless
              prefix="color"
              values={values.color}
              setValues={(v) => updateValue(v, 'color')}
            />
            <Input
              type="select"
              id="colorOp"
              name="colorOp"
              value={values.colorOp}
              onChange={(event) => updateValue(event.target.value, 'colorOp')}
            >
              <option value="=">Exactly these colors</option>
              <option value=">=">Including these colors</option>
              <option value="<=">At most these colors</option>
            </Input>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupText>Color Identity</InputGroupText>
            <ColorChecksAddon
              colorless
              prefix="identity"
              values={values.colorIdentity}
              setValues={(v) => updateValue(v, 'colorIdentity')}
            />
            <Input
              type="select"
              id="identityOp"
              name="identityOp"
              value={values.colorIdentityOp}
              onChange={(event) => updateValue(event.target.value, 'colorIdentityOp')}
            >
              <option value="=">Exactly these colors</option>
              <option value=">=">Including these colors</option>
              <option value="<=">At most these colors</option>
            </Input>
          </InputGroup>
          <TextField
            name="mana"
            humanName="Mana Cost"
            placeholder={'Any mana cost, e.g. "{1}{W}"'}
            value={values.mana}
            onChange={(event) => updateValue(event.target.value, 'mana')}
          />
          <InputGroup className="mb-3">
            <InputGroupText>Manacost Type</InputGroupText>
            <Input
              type="select"
              name="is"
              value={values.is}
              onChange={(event) => updateValue(event.target.value, 'is')}
            >
              {['', 'Gold', 'Hybrid', 'Phyrexian'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Input>
          </InputGroup>
          <TextField
            name="type"
            humanName="Type Line"
            placeholder="Choose any card type, supertype, or subtypes to match"
            value={values.type}
            onChange={(event) => updateValue(event.target.value, 'type')}
          />
          <TextField
            name="set"
            humanName="Set"
            placeholder={'Any set code, e.g. "WAR"'}
            value={values.set}
            onChange={(event) => updateValue(event.target.value, 'set')}
          />
          {cubeId && (
            <InputGroup className="mb-3">
              <InputGroupText>Tag</InputGroupText>
              <AutocompleteInput
                treeUrl={`/cube/api/cubecardtags/${cubeId}`}
                treePath="tags"
                type="text"
                name="tag"
                value={values.tag}
                onChange={(event) => updateValue(event.target.value, 'tag')}
                placeholder={'Any text, e.g. "Zombie Testing"'}
                autoComplete="off"
                data-lpignore
                className="tag-autocomplete-input"
                wrapperClassName="tag-autocomplete-wrapper"
              />
            </InputGroup>
          )}
          <Row className="row-mid-padding">
            <Col md={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Status</InputGroupText>
                <Input
                  type="select"
                  name="status"
                  value={values.status}
                  onChange={(event) => updateValue(event.target.value, 'status')}
                >
                  {['', 'Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Input>
              </InputGroup>
            </Col>
            <Col md={6}>
              <InputGroup className="mb-3">
                <InputGroupText>Finish</InputGroupText>
                <Input
                  type="select"
                  name="finish"
                  value={values.finish}
                  onChange={(event) => updateValue(event.target.value, 'finish')}
                >
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
                humanName="Price USD"
                placeholder={'Any decimal number, e.g. "3.50"'}
                value={values.price}
                operator={values.priceOp}
                setValue={(value) => updateValue(value, 'price')}
                setOperator={(operator) => updateValue(operator, 'priceOp')}
              />
            </Col>
            <Col md={6}>
              <NumericField
                name="priceFoil"
                humanName="Price USD Foil"
                placeholder={'Any decimal number, e.g. "14.00"'}
                value={values.priceFoil}
                operator={values.priceFoilOp}
                setValue={(value) => updateValue(value, 'priceFoil')}
                setOperator={(operator) => updateValue(operator, 'priceFoilOp')}
              />
            </Col>
            <Col md={6}>
              <NumericField
                name="priceEur"
                humanName="Price EUR"
                placeholder={'Any decimal number, e.g. "14.00"'}
                value={values.priceEur}
                operator={values.priceEurOp}
                setValue={(value) => updateValue(value, 'priceEur')}
                setOperator={(operator) => updateValue(operator, 'priceEurOp')}
              />
            </Col>
            <Col md={6}>
              <NumericField
                name="priceTix"
                humanName="MTGO TIX"
                placeholder={'Any decimal number, e.g. "14.00"'}
                value={values.priceTix}
                operator={values.priceTixOp}
                setValue={(value) => updateValue(value, 'priceTix')}
                setOperator={(operator) => updateValue(operator, 'priceTixOp')}
              />
            </Col>
          </Row>
          <NumericField
            name="elo"
            humanName="Elo"
            placeholder={'Any integer number, e.g. "1200"'}
            value={values.elo}
            operator={values.eloOp}
            setValue={(value) => updateValue(value, 'elo')}
            setOperator={(operator) => updateValue(operator, 'eloOp')}
          />
          <NumericField
            name="power"
            humanName="Power"
            placeholder={'Any value, e.g. "2"'}
            value={values.power}
            operator={values.powerOp}
            setValue={(value) => updateValue(value, 'power')}
            setOperator={(operator) => updateValue(operator, 'powerOp')}
          />
          <NumericField
            name="toughness"
            humanName="Toughness"
            placeholder={'Any value, e.g. "2"'}
            value={values.toughness}
            operator={values.toughnessOp}
            setValue={(value) => updateValue(value, 'toughness')}
            setOperator={(operator) => updateValue(operator, 'toughnessOp')}
          />
          <NumericField
            name="loyalty"
            humanName="Loyalty"
            placeholder={'Any value, e.g. "3"'}
            value={values.loyalty}
            operator={values.loyaltyOp}
            setValue={(value) => updateValue(value, 'loyalty')}
            setOperator={(operator) => updateValue(operator, 'loyaltyOp')}
          />
          <NumericField
            name="rarity"
            humanName="Rarity"
            placeholder={'Any rarity, e.g. "common"'}
            value={values.rarity}
            operator={values.rarityOp}
            setValue={(value) => updateValue(value, 'rarity')}
            setOperator={(operator) => updateValue(operator, 'rarityOp')}
          />
          <InputGroup className="mb-3">
            <InputGroupText>Legality</InputGroupText>
            <Input
              type="select"
              id="legalityOp"
              name="legalityOp"
              onChange={(event) => updateValue(event.target.value, 'legalityOp')}
            >
              <option value="=">legal</option>
              <option value="!=">not legal</option>
            </Input>
            <Input
              type="select"
              name="legality"
              value={values.legality}
              onChange={(event) => updateValue(event.target.value, 'legality')}
            >
              {[
                '',
                'Standard',
                'Pioneer',
                'Modern',
                'Legacy',
                'Vintage',
                'Brawl',
                'Historic',
                'Pauper',
                'Penny',
                'Commander',
              ].map((legality) => (
                <option key={legality}>{legality}</option>
              ))}
            </Input>
          </InputGroup>
          <TextField
            name="artist"
            humanName="Artist"
            placeholder={'Any text, e.g. "seb"'}
            value={values.artist}
            onChange={(event) => updateValue(event.target.value, 'artist')}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="unsafe" aria-label="Close" onClick={toggle}>
            Cancel
          </Button>
          <Button color="accent" type="submit">
            Apply
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

AdvancedFilterModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  apply: PropTypes.func.isRequired,
  values: PropTypes.shape({
    name: PropTypes.string,
    tag: PropTypes.string,
    status: PropTypes.string,
    finish: PropTypes.string,
    price: PropTypes.number,
    oracle: PropTypes.string,
    cmc: PropTypes.number,
    cmcOp: PropTypes.string,
    colorOp: PropTypes.string,
    color: PropTypes.string,
    type: PropTypes.string,
    colorIdentity: PropTypes.string,
    colorIdentityOp: PropTypes.string,
    mana: PropTypes.string,
    manaOp: PropTypes.string,
    is: PropTypes.string,
    set: PropTypes.string,
    priceOp: PropTypes.string,
    priceFoil: PropTypes.number,
    priceFoilOp: PropTypes.string,
    priceEur: PropTypes.number,
    priceEurOp: PropTypes.string,
    priceTix: PropTypes.number,
    priceTixOp: PropTypes.string,
    elo: PropTypes.number,
    eloOp: PropTypes.string,
    power: PropTypes.number,
    powerOp: PropTypes.string,
    toughness: PropTypes.number,
    toughnessOp: PropTypes.string,
    loyalty: PropTypes.number,
    loyaltyOp: PropTypes.string,
    rarity: PropTypes.string,
    rarityOp: PropTypes.string,
    legality: PropTypes.string,
    legalityOp: PropTypes.string,
    artist: PropTypes.string,
  }).isRequired,
  updateValue: PropTypes.func.isRequired,
};

const FilterCollapse = ({ defaultFilterText, filter, setFilter, noCount, numCards, numShown }) => {
  const [loading, setLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterInput, setFilterInput] = useQueryParam('f', defaultFilterText);
  const [values, setValues] = useState({});
  const [valid, setValid] = useState(true);

  useEffect(
    (overrideFilter) => {
      if (filter && Query.get('f') === filterInput) {
        return;
      }

      const input = overrideFilter ?? filterInput;
      if ((input ?? '') === '') {
        setFilter(null, '');
        return;
      }

      const { newFilter, err } = makeFilter(input);
      if (err) {
        setValid(false);
        return;
      }
      setValid(true);

      // TODO: Copy to advanced filter boxes.
      setLoading(true);
      setFilter(newFilter, input);
      setLoading(false);
    },
    [filter, filterInput, setFilter],
  );

  const applyAdvanced = useCallback(async () => {
    // Advanced Filter change. Render to filter input.
    const tokens = [];
    for (const name of allFields) {
      if (values[name]) {
        const op = numFields.includes(name) ? values[`${name}Op`] || '=' : ':';
        let value = values[name].replace('"', '\\"');
        if (value.indexOf(' ') > -1) {
          value = `"${value}"`;
        }
        tokens.push(`${name}${op}${value}`);
      }
    }
    for (const name of colorFields) {
      const colors = [];
      const op = values[`${name}Op`] || '=';
      for (const color of [...'WUBRG']) {
        if (values[name + color]) {
          colors.push(color);
        }
      }
      if (colors.length > 0) {
        tokens.push(`${name}${op}${colors.join('')}`);
      }
    }
    setFilterInput(tokens.join(' '));
    setAdvancedOpen(false);
  }, [setFilterInput, values]);

  const applyQuick = useCallback(async () => {
    const tokens = [];
    for (const name of quickFields) {
      if (values[name]) {
        const op = numFields.includes(name) ? values[`${name}Op`] || '=' : ':';
        let value = values[name].replace('"', '\\"');
        if (value.indexOf(' ') > -1) {
          value = `"${value}"`;
        }
        tokens.push(`${name}${op}${value}`);
      }
    }
    for (const name of colorFields) {
      const colors = [];
      const op = values[`${name}Op`] || '=';
      for (const color of [...'WUBRG']) {
        if (values[name + color]) {
          colors.push(color);
        }
      }
      if (colors.length > 0) {
        tokens.push(`${name}${op}${colors.join('')}`);
      }
    }
    setFilterInput(tokens.join(' '));
    setAdvancedOpen(false);
  }, [setFilterInput, values]);

  const reset = useCallback(() => {
    setFilterInput('');
    setFilter(null, '');
  }, [setFilter, setFilterInput]);

  const updateValue = useCallback(
    (value, name) => {
      const newValues = { ...values };
      newValues[name] = value;
      setValues(newValues);
    },
    [values],
  );

  const appliedText = useMemo(
    () =>
      `Filters applied${typeof numCards !== 'undefined' ? `: ${numCards} cards` : ''}${
        typeof numShown !== 'undefined' ? `, ${numShown} shown` : ''
      }.`,
    [numCards, numShown],
  );

  return (
    <Collapse className="px-3">
      <Row>
        <Col>
          <Form>
            <InputGroup className="mb-3">
              <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
              <Input
                type="text"
                id="filterInput"
                name="filterInput"
                placeholder={'name:"Ambush Viper"'}
                disabled={loading}
                valid={filterInput.length > 0 && valid}
                invalid={filterInput.length > 0 && !valid}
                value={filterInput}
                onChange={(event) => setFilterInput(event.target.value)}
              />
            </InputGroup>
          </Form>
        </Col>
      </Row>
      <Form className="row ps-2">
        <Col xs={9} sm="auto" style={{ padding: '0 5px' }}>
          <ColorChecksControl
            size="sm"
            className="mb-3"
            colorless
            prefix="colorQuick"
            values={values.color || []}
            setValues={(colors) => updateValue(colors, 'color')}
          />
        </Col>
        <Col xs={9} sm="auto" style={{ padding: '0 5px' }}>
          <InputGroup size="sm" className="mb-3">
            <InputGroupText htmlFor="cmcQuick">Mana Value</InputGroupText>
            <Input
              id="cmcQickOp"
              type="select"
              name="cmcQuickOp"
              value={values.cmcOp || '='}
              onChange={(event) => updateValue(event.target.value, 'cmcOp')}
              bsSize="sm"
              style={{ textAlignLast: 'center', maxWidth: '3.5rem' }}
            >
              <option>{'>'}</option>
              <option>{'>='}</option>
              <option>=</option>
              <option>{'<='}</option>
              <option>{'<'}</option>
            </Input>
            <Input
              name="cmcQuick"
              id="cmcQuick"
              value={values.cmc}
              onChange={(event) => updateValue(event.target.value, 'cmc')}
              bsSize="sm"
              className="square-left"
              style={{ width: '3rem' }}
            />
          </InputGroup>
        </Col>
        <Col xs={9} sm="auto" style={{ padding: '0 5px' }}>
          <InputGroup size="sm" className="mb-3">
            <InputGroupText htmlFor="typeQuick">Type</InputGroupText>
            <Input
              name="typeQuick"
              id="typeQuick"
              value={values.type}
              onChange={(event) => updateValue(event.target.value, 'type')}
              style={{ width: '8rem' }}
            />
          </InputGroup>
        </Col>
        <Col xs={9} sm="auto" style={{ padding: '0 5px' }}>
          <InputGroup size="sm" className="mb-3">
            <InputGroupText htmlFor="textQuick">Text</InputGroupText>
            <Input
              name="textQuick"
              id="textQuick"
              value={values.oracle}
              onChange={(event) => updateValue(event.target.value, 'oracle')}
              style={{ width: '8rem' }}
            />
          </InputGroup>
        </Col>
        <Col xs={9} sm="auto" style={{ padding: '0 5px' }}>
          <Button type="submit" onClick={applyQuick} size="sm" color="accent" className="mb-3">
            Quick Filter
          </Button>
        </Col>
      </Form>
      <Row>
        <Col>
          {!noCount && <p>{!filter || filter.length === 0 ? <em>No filters applied.</em> : <em>{appliedText}</em>}</p>}
        </Col>
      </Row>
      <Row>
        <Col>
          <Button color="unsafe" className="me-2 mb-3" onClick={reset}>
            Reset Filters
          </Button>
          <Button color="primary" className="me-2 mb-3" onClick={() => setAdvancedOpen(true)}>
            Advanced...
          </Button>
          <Button color="secondary" className="me-2 mb-3" href="/filters">
            Syntax Guide
          </Button>
        </Col>
      </Row>
      <AdvancedFilterModal
        isOpen={advancedOpen}
        toggle={() => setAdvancedOpen(false)}
        apply={applyAdvanced}
        values={values}
        updateValue={updateValue}
      />
    </Collapse>
  );
};

FilterCollapse.propTypes = {
  defaultFilterText: PropTypes.string,
  filter: PropTypes.func,
  setFilter: PropTypes.func.isRequired,
  noCount: PropTypes.bool,
  numCards: PropTypes.number,
  numShown: PropTypes.number,
};

FilterCollapse.defaultProps = {
  defaultFilterText: '',
  filter: () => true,
  noCount: false,
  numCards: undefined,
  numShown: undefined,
};

export default FilterCollapse;
