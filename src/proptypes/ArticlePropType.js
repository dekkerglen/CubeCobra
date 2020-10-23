import PropTypes from 'prop-types';

const ArticlePropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  // For article preview
  short: PropTypes.string.isRequired,
  artist: PropTypes.string.isRequired,
  image: PropTypes.string.isRequired,
});

export default ArticlePropType;
