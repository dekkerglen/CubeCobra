import React from 'react';

import { Button, Col, Collapse, Container, Form, Input, InputGroup, InputGroupAddon, InputGroupText, Row } from 'reactstrap';

function handleClick(event) {
  event.preventDefault();
  const value = document.getElementById('filterInput').value;
  /* global */
  updateFilters(value);
}

function handleKeyDown(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    const value = event.target.value;
    /* global */
    updateFilters(value);
  }
}

function handleReset(event) {
  document.getElementById('filterInput').value = '';
  /* global */
  updateFilters('');

  /* global */
  filters = [];
  addUrlToFilter();
  updateCubeList();
}

const FilterCollapse = props =>
  <Collapse {...props}>
    <Container>
      <Row>
        <Col>
          <Form>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
              </InputGroupAddon>
              <Input type="text" id="filterInput" placeholder={'name:"Ambush Viper"'} onKeyDown={handleKeyDown} />
              <InputGroupAddon addonType="append">
                <Button color="success" onClick={handleClick}>Apply</Button>
              </InputGroupAddon>
            </InputGroup>
          </Form>
          <h5>Filters</h5>
          <div id="filterarea" />
        </Col>
      </Row>
      <Row>
        <Col>
          <Button color="success" id="resetButton" className="mr-sm-2 mb-3" onClick={handleReset}>
            Reset Filters
          </Button>
          <Button color="success" id="advancedSearchButton" className="mr-sm-2 mb-3" data-toggle="modal" data-target="#filterModal">
            Advanced...
          </Button>
          <Button color="success" className="mr-sm-2 mb-3" href="/filters">Syntax Guide</Button>
        </Col>
      </Row>
    </Container>
  </Collapse>;

export default FilterCollapse;
