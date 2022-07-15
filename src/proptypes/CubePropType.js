import PropTypes from 'prop-types';

const CubePropType = PropTypes.shape({
  Id: PropTypes.string.isRequired,
  Name: PropTypes.string.isRequired,
});

export default CubePropType;
