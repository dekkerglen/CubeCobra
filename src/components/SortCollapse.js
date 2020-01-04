import React, { Component } from 'react';

import { Button, Col, Collapse, Container, Input, Row, UncontrolledAlert } from 'reactstrap';

import { csrfFetch } from '../util/CSRF';

import SortContext from './SortContext';

class SortCollapseRaw extends Component {
  constructor(props) {

    super(props);

    this.state = {
      alerts: [],
    };

    this.handleSave = this.handleSave.bind(this);
  }

  addAlert(color, message) {
    this.setState(({ alerts }) => ({
      alerts: [...alerts, { color, message }],
    }));
  }

  handleSave() {
    const { primary, secondary } = this.props;

    csrfFetch('/cube/api/savesorts/' + $('#cubeID').val(), {
      method: 'POST',
      body: JSON.stringify({
        sorts: [primary, secondary],
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(() => this.addAlert('success', 'Default sorts saved.'))
      .catch((err) => this.addAlert('danger', 'Error saving default sorts.'));
  }

  render() {
    const { primary, secondary, changeSort, canEdit, ...props } = this.props;
    return (
      <Collapse {...props}>
        <Container>
          <Row>
            <Col>
              {this.state.alerts.map((alert, index) => (
                <UncontrolledAlert key={index} className="w-100 mb-1" color={alert.color}>
                  {alert.message}
                </UncontrolledAlert>
              ))}
            </Col>
          </Row>
          <Row>
            <Col xs="12" sm="6" className="mt-2">
              <h6>Primary Sort</h6>
              <Input type="select" value={primary} onChange={(e) => changeSort({ primary: e.target.value })}>
                {getSorts().map((sort) => (
                  <option key={sort}>{sort}</option>
                ))}
              </Input>
            </Col>
            <Col xs="12" sm="6" className="mt-2">
              <h6>Secondary Sort</h6>
              <Input type="select" value={secondary} onChange={(e) => changeSort({ secondary: e.target.value })}>
                {getSorts().map((sort) => (
                  <option key={sort}>{sort}</option>
                ))}
              </Input>
            </Col>
          </Row>
          <Row>
            <Col>
              <p className="my-2">
                <em>
                  Cards will be appear as duplicates if they fit in multiple categories. The counts will still only
                  count each item once.
                </em>
              </p>
            </Col>
          </Row>
          <Row className="mb-3">
            {!canEdit ? (
              ''
            ) : (
              <Col>
                <Button color="success" onClick={this.handleSave}>
                  Save as Default Sort
                </Button>
              </Col>
            )}
          </Row>
        </Container>
      </Collapse>
    );
  }
}

const SortCollapse = (props) => (
  <SortContext.Consumer>
    {({ primary, secondary, changeSort }) => (
      <SortCollapseRaw primary={primary} secondary={secondary} changeSort={changeSort} {...props} />
    )}
  </SortContext.Consumer>
);

export default SortCollapse;
