import React, { useContext, useMemo } from 'react';
import { Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import AutocardListGroup from 'components/AutocardListGroup';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import { countGroup, sortDeep } from 'utils/Sort';

const TableView = ({ cards, noGroupModal, className, ...props }) => {
  const { compressedView } = useContext(DisplayContext);
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube } = useContext(CubeContext);

  const sorted = useMemo(
    () => sortDeep(cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary),
    [cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary],
  );

  return (
    <div className={`table-view-container${className ? ` ${className}` : ''}`}>
      <Row className={`table-view${compressedView ? ' compressed' : ''}`} {...props}>
        {sorted.map(([columnLabel, column]) => (
          <Col
            key={columnLabel}
            md={compressedView ? undefined : 'auto'}
            className="table-col"
            style={{
              width: `${100 / Math.min(sorted.length, 9)}%`,
              flexBasis: compressedView ? `${100 / Math.min(sorted.length, 9)}%` : undefined,
            }}
          >
            <h6 className="text-center card-list-heading">
              {columnLabel}
              <br />({countGroup(column)})
            </h6>
            {column.map(([label, row]) => (
              <AutocardListGroup
                key={label}
                heading={`${label} (${countGroup(row)})`}
                cards={row}
                noGroupModal={noGroupModal}
                sort={sortTertiary}
                orderedSort={sortQuaternary}
                showOther={cube.showUnsorted}
              />
            ))}
          </Col>
        ))}
      </Row>
    </div>
  );
};

TableView.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  noGroupModal: PropTypes.bool,
  className: PropTypes.string,
};

TableView.defaultProps = {
  noGroupModal: false,
  className: null,
};

export default TableView;
