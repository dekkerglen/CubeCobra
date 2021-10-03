import React from 'react';
import PropTypes from 'prop-types';

// TODO: reimplement this
const DraftbotBreakdown = () => {
  return <>Under Construction!</>;
};

DraftbotBreakdown.propTypes = {
  // eslint-disable-next-line
  draft: DraftPropType.isRequired,
  // eslint-disable-next-line
  seatIndex: PropTypes.oneOfType([PropTypes.number.isRequired, PropTypes.string.isRequired]).isRequired,
  // eslint-disable-next-line
  defaultIndex: PropTypes.number,
};

DraftbotBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DraftbotBreakdown;
