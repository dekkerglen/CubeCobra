import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { Row, Col } from 'reactstrap';

import { countGroup, sortDeep } from 'utils/Sort';

import AutocardListGroup from 'components/AutocardListGroup';
import AutocardListItem from 'components/AutocardListItem';
import DisplayContext from 'components/DisplayContext';
import SortContext from 'components/SortContext';

const TableView = ({ cards, rowTag, noGroupModal, className, ...props }) => {
  const { primary, secondary } = useContext(SortContext);
  const { compressedView } = useContext(DisplayContext);

  const sorted = sortDeep(cards, primary, secondary);

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
                rowTag={rowTag}
                noGroupModal={noGroupModal}
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
  rowTag: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  noGroupModal: PropTypes.bool,
  className: PropTypes.string,
};

TableView.defaultProps = {
  rowTag: AutocardListItem,
  noGroupModal: false,
  className: null,
};

export default TableView;
