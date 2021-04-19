import PropTypes from 'prop-types';

const VideoPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  // For video preview
  artist: PropTypes.string.isRequired,
  short: PropTypes.string.isRequired,
  image: PropTypes.string.isRequired,
  imagename: PropTypes.string.isRequired,
});

export default VideoPropType;
