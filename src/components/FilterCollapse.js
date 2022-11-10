import React, { useCallback, useState, useContext } from 'react';
import PropTypes from 'prop-types';

import { Button, Col, Row, Collapse, Input, InputGroup, InputGroupText } from 'reactstrap';

import { ColorChecksControl } from 'components/ColorCheck';

import AdvancedFilterModal from 'components/AdvancedFilterModal';
import CubeContext from 'contexts/CubeContext';

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

const FilterCollapse = ({ isOpen }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [values, setValues] = useState({});

  const { filterInput, setFilterInput, filterValid, filterResult } = useContext(CubeContext);

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
      const op = values[`${name}Op`] || '=';
      if (values[name] && values[name].length > 0) {
        tokens.push(`${name}${op}${values[name].join('')}`);
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
    setValues({});
  }, [setFilterInput]);

  const updateValue = useCallback(
    (value, name) => {
      const newValues = { ...values };
      newValues[name] = value;
      setValues(newValues);
    },
    [values],
  );

  return (
    <Collapse className="px-3" isOpen={isOpen}>
      <Row>
        <Col>
          <InputGroup>
            <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
            <Input
              type="text"
              id="filterInput"
              name="filterInput"
              placeholder={'name:"Ambush Viper"'}
              valid={filterInput.length > 0 && filterValid}
              invalid={filterInput.length > 0 && !filterValid}
              value={filterInput}
              onChange={(event) => setFilterInput(event.target.value)}
            />
          </InputGroup>
          <small>
            Having trouble using filter syntax? Check out our <a href="/filters">syntax guide</a>.
          </small>
        </Col>
      </Row>
      <Row className="mt-2">
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
      </Row>
      {filterResult && filterResult.length > 0 && (
        <Row>
          <Col>
            <p>
              <em>{filterResult}</em>
            </p>
          </Col>
        </Row>
      )}
      <Row>
        <Col>
          <Button color="unsafe" className="me-2 mb-3" onClick={reset}>
            Reset Filters
          </Button>
          <Button color="primary" className="me-2 mb-3" onClick={() => setAdvancedOpen(true)}>
            Advanced...
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
  isOpen: PropTypes.bool,
};

FilterCollapse.defaultProps = {
  isOpen: false,
};

export default FilterCollapse;
