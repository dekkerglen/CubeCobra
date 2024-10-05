import React, { useCallback, useContext, useState } from 'react';
import { Button, Col, Collapse, Input, InputGroup, InputGroupText, Row } from 'reactstrap';

import AdvancedFilterModal from 'components/AdvancedFilterModal';
import { ColorChecksControl } from 'components/ColorCheck';
import CubeContext from 'contexts/CubeContext';
import { allFields, FilterValues, isColorField, isNumField } from 'datatypes/CardDetails';

interface FilterCollapseProps {
  isOpen: boolean;
  hideDescription: boolean;
}

const FilterCollapse: React.FC<FilterCollapseProps> = ({ isOpen = false, hideDescription = false }) => {
  const { filterInput, setFilterInput, filterValid, filterResult } = useContext(CubeContext)!;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [values, setValues] = useState<Partial<FilterValues>>({});
  const [searchFilterInput, setSearchFilterInput] = useState(filterInput);

  const applySearchFilter = () => {
    setFilterInput(searchFilterInput);
  };

  const applyAdvanced = useCallback(async () => {
    const tokens: string[] = [];
    for (const name of allFields) {
      if (values[name]) {
        if (isColorField(name)) {
          const op = values[`${name}Op`] || '=';
          if (values[name] && (values[name] as string[]).length > 0) {
            tokens.push(`${name}${op}${(values[name] as string[]).join('')}`);
          }
        } else {
          const op = isNumField(name) ? values[`${name}Op`] || '=' : ':';
          let value = (values[name] as string).replace('"', '\\"');
          if (value.indexOf(' ') > -1) {
            value = `"${value}"`;
          }
          tokens.push(`${name}${op}${value}`);
        }
      }
    }
    const filterString = tokens.join(' ');
    setSearchFilterInput(filterString);
    setFilterInput(filterString);
    setAdvancedOpen(false);
  }, [setFilterInput, setSearchFilterInput, values]);

  const applyQuick = useCallback(async () => {
    const tokens: string[] = [];

    if (values.color && (values.color as string[]).length > 0) {
      tokens.push(`ci=${(values.color as string[]).join('')}`);
    }

    if (values.mv) {
      const op = values.mvOp || '=';

      tokens.push(`mv${op}${values.mv}`);
    }

    if (values.type) {
      tokens.push(`t:${values.type}`);
    }

    if (values.oracle) {
      tokens.push(`o:${values.oracle}`);
    }

    const filterString = tokens.join(' ');
    setSearchFilterInput(filterString);
    setFilterInput(filterString);
    setAdvancedOpen(false);
  }, [setFilterInput, setSearchFilterInput, values]);

  const reset = useCallback(() => {
    setFilterInput('');
    setValues({});
  }, [setFilterInput]);

  const updateValue = useCallback(
    (value: string | string[], name: keyof FilterValues) => {
      setValues({ ...values, [name]: value as any });
    },
    [values],
  );

  const handleOnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    applySearchFilter();
  };

  return (
    <Collapse className="px-3" isOpen={isOpen}>
      <Row>
        <Col>
          <form onSubmit={handleOnSubmit} className="input">
            <InputGroup>
              <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
              <Input
                type="text"
                id="filterInput"
                name="filterInput"
                placeholder={'name:"Ambush Viper"'}
                valid={(filterInput?.length ?? 0) > 0 && filterValid}
                invalid={(filterInput?.length ?? 0) > 0 && !filterValid}
                value={searchFilterInput ?? ''}
                onChange={(event) => setSearchFilterInput(event.target.value)}
              />
              <Button color="primary" type="submit">
                Apply
              </Button>
            </InputGroup>
          </form>
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
            values={(values.color as string[]) || []}
            setValues={(colors) => updateValue(colors, 'color')}
          />
        </Col>
        <Col xs={9} sm="auto" style={{ padding: '0 5px' }}>
          <InputGroup size="sm" className="mb-3">
            <InputGroupText htmlFor="mvQuick">Mana Value</InputGroupText>
            <Input
              id="mvQickOp"
              type="select"
              name="mvQuickOp"
              value={values.mvOp || '='}
              onChange={(event) => updateValue(event.target.value, 'mvOp')}
              bsSize="sm"
              style={{ textAlignLast: 'center', maxWidth: '5rem' }}
            >
              {['=', '>', '>=', '<', '<='].map((op) => (
                <option key={op}>{op}</option>
              ))}
            </Input>
            <Input
              name="mvQuick"
              id="mvQuick"
              value={values.mv}
              onChange={(event) => updateValue(event.target.value, 'mv')}
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
      {filterResult && filterResult.length > 0 && !hideDescription && (
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
          <Button color="accent" className="me-2 mb-3" onClick={() => setAdvancedOpen(true)}>
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

export default FilterCollapse;
