import React, { useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button, Col, Collapse, Container, Input, Row } from 'reactstrap';

import { SORTS, ORDERED_SORTS } from 'utils/Sort';

import CubeContext from 'contexts/CubeContext';
import Tooltip from 'components/Tooltip';

const SortCollapse = ({ isOpen }) => {
  const {
    canEdit,
    cube,
    setShowUnsorted,
    saveSorts,
    resetSorts,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
    setSortPrimary,
    setSortSecondary,
    setSortTertiary,
    setSortQuaternary,
  } = useContext(CubeContext);

  const sortsModified = useMemo(() => {
    return (
      sortPrimary !== (cube.DefaultSorts[0] || 'Color Category') ||
      sortSecondary !== (cube.DefaultSorts[1] || 'Types-Multicolor') ||
      sortTertiary !== (cube.DefaultSorts[2] || 'Mana Value') ||
      sortQuaternary !== (cube.DefaultSorts[3] || 'Alphabetical')
    );
  }, [sortPrimary, cube.DefaultSorts, sortSecondary, sortTertiary, sortQuaternary]);

  return (
    <Collapse isOpen={isOpen}>
      <Container>
        <Row>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Primary Sort</h6>
            <Input
              type="select"
              value={sortPrimary}
              onChange={(e) => {
                setSortPrimary(e.target.value);
              }}
            >
              {SORTS.map((sort) => (
                <option key={`primary-${sort}`} value={sort}>
                  {sort}
                </option>
              ))}
            </Input>
          </Col>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Secondary Sort</h6>
            <Input
              type="select"
              value={sortSecondary}
              onChange={(e) => {
                setSortSecondary(e.target.value);
              }}
            >
              {SORTS.map((sort) => (
                <option key={`secondary-${sort}`} value={sort}>
                  {sort}
                </option>
              ))}
            </Input>
          </Col>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Tertiary Sort</h6>
            <Input
              type="select"
              value={sortTertiary}
              onChange={(e) => {
                setSortTertiary(e.target.value);
              }}
            >
              {SORTS.map((sort) => (
                <option key={`tertiary-${sort}`} value={sort}>
                  {sort}
                </option>
              ))}
            </Input>
          </Col>
          <Col xs="12" sm="6" className="mt-2">
            <h6>Ordered Sort</h6>
            <Input
              type="select"
              value={sortQuaternary}
              onChange={(e) => {
                setSortQuaternary(e.target.value);
              }}
            >
              {ORDERED_SORTS.map((sort) => (
                <option key={`quaternary-${sort}`} value={sort}>
                  {sort}
                </option>
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
            <Button color="accent" className="me-sm-2 mb-3" onClick={resetSorts} disabled={!sortsModified}>
              Reset Sort
            </Button>
            {!canEdit ? (
              false
            ) : (
              <Button color="accent" className="me-sm-2 mb-3" onClick={saveSorts} disabled={!sortsModified}>
                Save as Default Sort
              </Button>
            )}
            <Button
              color={cube.ShowUnsorted ? 'unsafe' : 'primary'}
              className="me-sm-2 mb-3"
              onClick={() => setShowUnsorted(!cube.ShowUnsorted)}
            >
              <Tooltip text="Creates a separate column for cards that would be hidden otherwise.">
                {cube.ShowUnsorted ? 'Hide' : 'Show'} Unsorted Cards
              </Tooltip>
            </Button>
          </Col>
        </Row>
      </Container>
    </Collapse>
  );
};

SortCollapse.propTypes = {
  isOpen: PropTypes.bool,
};

SortCollapse.defaultProps = {
  isOpen: false,
};
export default SortCollapse;
