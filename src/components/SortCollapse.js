import React, { useCallback, useContext, useState, useRef, useEffect } from 'react';

import { Button, Col, Collapse, Container, Input, Row, UncontrolledAlert } from 'reactstrap';

import { csrfFetch } from '../utils/CSRF';
import { getSorts } from '../utils/Sort';

import CubeContext from './CubeContext';
import SortContext from './SortContext';
import Query from 'utils/Query';

const SortCollapse = ({ defaultPrimarySort, defaultSecondarySort, defaultSorts, setSorts, ...props }) => {
  const [alerts, setAlerts] = useState([]);
  const { canEdit, cubeID } = useContext(CubeContext);
  const { primary, secondary, changeSort } = useContext(SortContext);

  const [defSorts, setDefSorts] = useState(
    defaultSorts && defaultSorts.length > 1 ? [...defaultSorts] : ['Color Category', 'Types-Multicolor'],
  );

  const prevSorts = useRef(defSorts);
  useEffect(() => {
    const sortTypes = getSorts();
    let currentPrimarySort = defaultPrimarySort || '';
    let currentSecondarySort = defaultSecondarySort || '';
    if (!sortTypes.includes(currentPrimarySort)) currentPrimarySort = '';
    if (!sortTypes.includes(currentSecondarySort)) currentSecondarySort = '';

    if (prevSorts[0] !== currentPrimarySort || prevSorts[1] !== currentSecondarySort) {
      if (!currentPrimarySort || currentPrimarySort === defSorts[0]) {
        Query.del('s1');
        currentPrimarySort = defSorts[0];
      }
      if (!currentSecondarySort || currentSecondarySort === defSorts[1]) {
        Query.del('s2');
        currentSecondarySort = defSorts[1];
      }
      prevSorts.current = [currentPrimarySort, currentSecondarySort];
      if(setSorts) {
        setSorts(prevSorts.current);
      }
      changeSort({ primary: currentPrimarySort, secondary: currentSecondarySort });
    }
  }, [defaultPrimarySort, defaultSecondarySort, setSorts]);

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
        .then(() => {
          Query.del('s1');
          Query.del('s2');
          setDefSorts([primary, secondary]);
          addAlert('success', 'Default sorts saved.');
        })
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
            <Input
              type="select"
              value={primary}
              onChange={(e) => {
                const newPrimary = e.target.value;
                if (!newPrimary || newPrimary === defSorts[0]) {
                  Query.del('s1');
                } else {
                  Query.set('s1', newPrimary);
                }
                changeSort({ primary: newPrimary });
              }}
            >
              {getSorts().map((sort) => (
                <option key={sort}>{sort}</option>
              ))}
            </Input>
          </Col>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Secondary Sort</h6>
            <Input
              type="select"
              value={secondary}
              onChange={(e) => {
                const newSecondary = e.target.value;
                if (!newSecondary || newSecondary === defSorts[1]) {
                  Query.del('s2');
                } else {
                  Query.set('s2', newSecondary);
                }
                changeSort({ secondary: newSecondary });
              }}
            >
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
          <Col>
            <Button
              color="success"
              className="mr-sm-2 mb-3"
              onClick={(e) => {
                Query.del('s1');
                Query.del('s2');
                changeSort({ primary: defSorts[0], secondary: defSorts[1] });
              }}
            >
              Reset Sort
            </Button>
            {!canEdit ? (
              false
            ) : (
              <Button color="success" className="mr-sm-2 mb-3" onClick={handleSave}>
                Save as Default Sort
              </Button>
            )}
          </Col>
        </Row>
      </Container>
    </Collapse>
  );
};

export default SortCollapse;
