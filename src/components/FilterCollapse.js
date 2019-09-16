import React from 'react';

import { Button, Col, Collapse, Container, Input, InputGroup, InputGroupAddon, InputGroupText, Row } from 'reactstrap';

const FilterCollapse = props =>
  <Collapse {...props}>
    <Container>
      <Row>
        <Col>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
            </InputGroupAddon>
            <Input type="text" id="filterInput" placeholder={'name:"Ambush Viper"'} />
            <InputGroupAddon addonType="append">
              <Button color="success" id="filterButton">Apply</Button>
            </InputGroupAddon>
          </InputGroup>
          <h5>Filters</h5>
          <div id="filterarea" />
        </Col>
      </Row>
      <Row>
        <Col>
          <Button color="success" id="resetButton" className="mr-sm-2 mb-3">Reset Filters</Button>
          <Button color="success" id="advancedSearchButton" className="mr-sm-2 mb-3" data-toggle="#filterModal">
            Advanced Search
          </Button>
          <Button color="success" className="mr-sm-2 mb-3" href="/filters">Syntax Guide</Button>
        </Col>
      </Row>
    </Container>
  </Collapse>;

export default FilterCollapse;
