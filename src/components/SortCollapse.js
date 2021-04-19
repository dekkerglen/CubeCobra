import React, { useCallback, useContext, useState, useRef, useEffect } from 'react';
import { Button, Col, Collapse, Container, Input, Row, UncontrolledAlert } from 'reactstrap';
import PropTypes from 'prop-types';

import { csrfFetch } from 'utils/CSRF';
import { SORTS, ORDERED_SORTS } from 'utils/Sort';

import CubeContext from 'contexts/CubeContext';
import SortContext from 'contexts/SortContext';
import Query from 'utils/Query';
import Tooltip from 'components/Tooltip';

const SortCollapse = ({
  defaultPrimarySort,
  defaultSecondarySort,
  defaultTertiarySort,
  defaultQuaternarySort,
  defaultShowUnsorted,
  defaultSorts,
  cubeDefaultShowUnsorted,
  setSorts,
  ...props
}) => {
  const [alerts, setAlerts] = useState([]);
  const { canEdit, cubeID } = useContext(CubeContext);
  const { primary, secondary, tertiary, quaternary, showOther, changeSort } = useContext(SortContext);

  const normalizeSort = (sort) => {
    if (sort === 'CMC') return 'Mana Value';
    if (sort === 'CMC2') return 'Mana Value 2';
    if (sort === 'CMC-Full') return 'Mana Value Full';
    return sort;
  };
  const formSorts = (src) => {
    const sorts = ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'];
    for (let i = 0; i < 4; i++) {
      if (src[i]) sorts[i] = normalizeSort(src[i]);
    }
    return sorts;
  };

  const [defSorts, setDefSorts] = useState(formSorts(defaultSorts));
  const [defShow, setDefShow] = useState(cubeDefaultShowUnsorted.toString());

  const prevSorts = useRef(defSorts);
  const prevShow = useRef(defShow);
  useEffect(() => {
    let currentPrimarySort = normalizeSort(defaultPrimarySort) ?? '';
    let currentSecondarySort = normalizeSort(defaultSecondarySort) ?? '';
    let currentTertiarySort = normalizeSort(defaultTertiarySort) ?? '';
    let currentQuaternarySort = normalizeSort(defaultQuaternarySort) ?? '';
    let currentShowUnsorted = defaultShowUnsorted ?? '';
    if (!SORTS.includes(currentPrimarySort)) currentPrimarySort = '';
    if (!SORTS.includes(currentSecondarySort)) currentSecondarySort = '';
    if (!SORTS.includes(currentTertiarySort)) currentTertiarySort = '';
    if (!ORDERED_SORTS.includes(currentQuaternarySort)) currentQuaternarySort = '';

    if (
      prevSorts[0] !== currentPrimarySort ||
      prevSorts[1] !== currentSecondarySort ||
      prevSorts[2] !== currentTertiarySort ||
      prevSorts[3] !== currentQuaternarySort ||
      prevShow.current !== currentShowUnsorted
    ) {
      if (!currentPrimarySort || currentPrimarySort === defSorts[0]) {
        Query.del('s1');
        [currentPrimarySort] = defSorts;
      }
      if (!currentSecondarySort || currentSecondarySort === defSorts[1]) {
        Query.del('s2');
        [, currentSecondarySort] = defSorts;
      }
      if (!currentTertiarySort || currentTertiarySort === defSorts[2]) {
        Query.del('s3');
        [, , currentTertiarySort] = defSorts;
      }
      if (!currentQuaternarySort || currentQuaternarySort === defSorts[3]) {
        Query.del('s4');
        [, , , currentQuaternarySort] = defSorts;
      }
      if (!currentShowUnsorted || currentShowUnsorted === defShow) {
        Query.del('so');
        currentShowUnsorted = defShow;
      }

      prevSorts.current = [currentPrimarySort, currentSecondarySort, currentTertiarySort, currentQuaternarySort];
      prevShow.current = currentShowUnsorted;
      if (setSorts) {
        setSorts(prevSorts.current);
      }
      changeSort({
        primary: currentPrimarySort,
        secondary: currentSecondarySort,
        tertiary: currentTertiarySort,
        quaternary: currentQuaternarySort,
      });
      if (currentShowUnsorted) {
        changeSort({ showOther: currentShowUnsorted === 'true' });
      }
    }
  }, [
    defaultPrimarySort,
    defaultSecondarySort,
    defaultTertiarySort,
    defaultQuaternarySort,
    defaultShowUnsorted,
    setSorts,
    changeSort,
    defSorts,
    defShow,
  ]);

  const addAlert = useCallback((color, message) => setAlerts((alertsB) => [...alertsB, { color, message }]), []);

  const handleReset = useCallback(() => {
    Query.del('s1');
    Query.del('s2');
    Query.del('s3');
    Query.del('s4');
    changeSort({ primary: defSorts[0], secondary: defSorts[1], tertiary: defSorts[2], quaternary: defSorts[3] });
  }, [defSorts, changeSort]);

  const handleSave = useCallback(async () => {
    try {
      await csrfFetch(`/cube/api/savesorts/${cubeID}`, {
        method: 'POST',
        body: JSON.stringify({
          sorts: [primary, secondary, tertiary, quaternary],
          showOther,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      addAlert('danger', 'Error saving default sorts.');
      return;
    }
    Query.del('s1');
    Query.del('s2');
    Query.del('s3');
    Query.del('s4');
    Query.del('so');
    setDefSorts([primary, secondary, tertiary, quaternary]);
    setDefShow(showOther.toString());
    addAlert('success', 'Default sorts saved.');
  }, [addAlert, cubeID, primary, secondary, tertiary, quaternary, showOther]);

  return (
    <Collapse {...props}>
      <Container>
        <Row>
          <Col>
            {alerts.map(({ color, message }, index) => (
              <UncontrolledAlert
                key={index /* eslint-disable-line react/no-array-index-key */}
                className="w-100 mb-1"
                color={color}
              >
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
              {SORTS.map((sort) => (
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
              {SORTS.map((sort) => (
                <option key={sort}>{sort}</option>
              ))}
            </Input>
          </Col>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Tertiary Sort</h6>
            <Input
              type="select"
              value={tertiary}
              onChange={(e) => {
                const newTertiary = e.target.value;
                if (!newTertiary || newTertiary === defSorts[2]) {
                  Query.del('s3');
                } else {
                  Query.set('s3', newTertiary);
                }
                changeSort({ tertiary: newTertiary });
              }}
            >
              {SORTS.map((sort) => (
                <option key={sort}>{sort}</option>
              ))}
            </Input>
          </Col>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Ordered Sort</h6>
            <Input
              type="select"
              value={quaternary}
              onChange={(e) => {
                const newQuaternary = e.target.value;
                if (!newQuaternary || newQuaternary === defSorts[3]) {
                  Query.del('s4');
                } else {
                  Query.set('s4', newQuaternary);
                }
                changeSort({ quaternary: newQuaternary });
              }}
            >
              {ORDERED_SORTS.map((sort) => (
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
            <Button color="success" className="mr-sm-2 mb-3" onClick={handleReset}>
              Reset Sort
            </Button>
            {!canEdit ? (
              false
            ) : (
              <Button color="success" className="mr-sm-2 mb-3" onClick={handleSave}>
                Save as Default Sort
              </Button>
            )}
            <Button
              color={showOther ? 'danger' : 'primary'}
              className="mr-sm-2 mb-3"
              onClick={() => {
                const newShowOther = !showOther;
                if (newShowOther.toString() === defShow) {
                  Query.del('so');
                } else {
                  Query.set('so', newShowOther);
                }
                changeSort({ showOther: newShowOther });
              }}
            >
              <Tooltip text="Creates a separate column for cards that would be hidden otherwise.">
                {showOther ? 'Hide' : 'Show'} Unsorted Cards
              </Tooltip>
            </Button>
          </Col>
        </Row>
      </Container>
    </Collapse>
  );
};

SortCollapse.propTypes = {
  defaultPrimarySort: PropTypes.string,
  defaultSecondarySort: PropTypes.string,
  defaultTertiarySort: PropTypes.string,
  defaultQuaternarySort: PropTypes.string,
  defaultShowUnsorted: PropTypes.string,
  defaultSorts: PropTypes.arrayOf(PropTypes.string.isRequired),
  cubeDefaultShowUnsorted: PropTypes.bool,
  setSorts: PropTypes.func.isRequired,
};
SortCollapse.defaultProps = {
  defaultPrimarySort: '',
  defaultSecondarySort: '',
  defaultTertiarySort: '',
  defaultQuaternarySort: '',
  defaultShowUnsorted: '',
  defaultSorts: ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'],
  cubeDefaultShowUnsorted: false,
};

export default SortCollapse;
