import PropTypes from 'prop-types';

const CommentPropType = PropTypes.shape({
  Id: PropTypes.string.isRequired,
  Parent: PropTypes.string.isRequired,
  Type: PropTypes.string.isRequired,
  Owner: PropTypes.string,
  Body: PropTypes.string.isRequired,
  Date: PropTypes.number.isRequired,
  User: PropTypes.shape({
    Id: PropTypes.string.isRequired,
    Username: PropTypes.string.isRequired,
  }),
  ImageData: PropTypes.shape({
    uri: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
  }),
});

export default CommentPropType;
