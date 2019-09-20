import React, { Component } from 'react';

import { Button, Col, Collapse, Container, Form, Input, InputGroup, InputGroupAddon, InputGroupText, Row } from 'reactstrap';

import Filter from '../util/Filter';
import Hash from '../util/Hash';

class FilterCollapse extends Component {
  constructor(props) {
    super(props);

    this.state = {
      filterInput: Hash.get('f', ''),
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleApply = this.handleApply.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleReset = this.handleReset.bind(this);

    this.updateFilters();
  }

  updateFilters() {
    const { filterInput } = this.state;
    const tokens = [];
    const valid = Filter.tokenizeInput(filterInput, tokens);
    if (!valid || !Filter.verifyTokens(tokens)) return;

    const filters = [Filter.parseTokens(tokens)];
    this.props.setFilter(filters);
    Hash.set('f', filterInput);
  }

  handleChange(event) {
    const target = event.target;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
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
    const { filter, setFilter, ...props } = this.props;
    const { filterInput } = this.state;
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
              {!filter || filter.length === 0 ? <p><em>No active filters.</em></p> :
                filter.map(f => <div>{JSON.stringify(f)}</div>)
              }
            </Col>
          </Row>
          <Row>
            <Col>
              <Button color="success" id="resetButton" className="mr-sm-2 mb-3" onClick={this.handleReset}>
                Reset Filters
              </Button>
              <Button color="success" id="advancedSearchButton" className="mr-sm-2 mb-3" data-toggle="modal" data-target="#filterModal">
                Advanced...
              </Button>
              <Button color="success" className="mr-sm-2 mb-3" href="/filters">Syntax Guide</Button>
            </Col>
          </Row>
        </Container>
      </Collapse>
    );
  }
}

export default FilterCollapse;
