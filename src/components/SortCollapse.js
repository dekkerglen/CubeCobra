import React from 'react';

import { Button, Col, Collapse, Container, Input, Row } from 'reactstrap';

import SortContext from './SortContext';

const SortCollapse = props =>
  <Collapse {...props}>
    <SortContext.Consumer>
      {({ primary, secondary, changeSort }) =>
        <Container>
          <Row>
            <Col xs="12" sm="6" className="mt-2">
              <h6>Primary Sort</h6>
              <Input type="select" value={primary} onChange={e => changeSort({ primary: e.target.value })}>
                {getSorts().map(sort => <option key={sort}>{sort}</option>)}
              </Input>
            </Col>
            <Col xs="12" sm="6" className="mt-2">
              <h6>Secondary Sort</h6>
              <Input type="select" value={secondary} onChange={e => changeSort({ secondary: e.target.value })}>
                {getSorts().map(sort => <option key={sort}>{sort}</option>)}
              </Input>
            </Col>
          </Row>
          <Row>
            <Col>
              <p className="my-2"><em>
                Cards will be appear as duplicates if they fit in multiple categories.
                The counts will still only count each item once.
              </em></p>
            </Col>
          </Row>
          <Row className="mb-3">
            {!canEdit ? '' :
              <Col>
                <Button color="success" id="saveSortButton">Save as Default Sort</Button>
              </Col>
            }
          </Row>
        </Container>
      }
    </SortContext.Consumer>
  </Collapse>;

export default SortCollapse;
