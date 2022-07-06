import PropTypes from 'prop-types';

const VideoPropType = PropTypes.shape({
  Id: PropTypes.string.isRequired,
  Title: PropTypes.string.isRequired,
  Body: PropTypes.string.isRequired,
  Date: PropTypes.instanceOf(Date).isRequired,
  Status: PropTypes.string.isRequired,
  Owner: PropTypes.string.isRequired,
  Username: PropTypes.string.isRequired,
  Url: PropTypes.string.isRequired,
  // For video preview
  Artist: PropTypes.string.isRequired,
  Short: PropTypes.string.isRequired,
  Image: PropTypes.string.isRequired,
  ImageName: PropTypes.string.isRequired,
});

export default VideoPropType;
