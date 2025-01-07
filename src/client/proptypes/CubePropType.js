import PropTypes from 'prop-types';

const CubePropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
});

export default CubePropType;
