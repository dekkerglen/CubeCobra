import React, { useCallback, useContext, useState } from 'react';

import { Button, Col, Collapse, Container, Input, Row, UncontrolledAlert } from 'reactstrap';

import { csrfFetch } from '../utils/CSRF';
import { getSorts } from '../utils/Sort';

import CubeContext from './CubeContext';
import SortContext from './SortContext';

const SortCollapse = (props) => {
  const [alerts, setAlerts] = useState([]);
  const { canEdit, cubeID } = useContext(CubeContext);
  const { primary, secondary, changeSort } = useContext(SortContext);

  const addAlert = useCallback((color, message) => setAlerts((alerts) => [...alerts, { color, message }]), []);

  const handleSave = useCallback(
    (event) => {
      csrfFetch(`/cube/api/savesorts/${cubeID}`, {
        method: 'POST',
        body: JSON.stringify({
          sorts: [primary, secondary],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(() => addAlert('success', 'Default sorts saved.'))
        .catch((err) => addAlert('danger', 'Error saving default sorts.'));
    },
    [addAlert, cubeID, primary, secondary],
  );

  return (
    <Collapse {...props}>
      <Container>
        <Row>
          <Col>
            {alerts.map(({ color, message }, index) => (
              <UncontrolledAlert key={index} className="w-100 mb-1" color={color}>
                {message}
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
                Cards will be appear as duplicates if they fit in multiple categories. The counts will still only count
                each item once.
              </em>
            </p>
          </Col>
        </Row>
        <Row className="mb-3">
          {!canEdit ? (
            false
          ) : (
            <Col>
              <Button color="success" onClick={handleSave}>
                Save as Default Sort
              </Button>
            </Col>
          )}
        </Row>
      </Container>
    </Collapse>
  );
};

export default SortCollapse;
