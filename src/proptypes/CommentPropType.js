import PropTypes from 'prop-types';

const CommentPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  parent: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  owner: PropTypes.string,
  body: PropTypes.string.isRequired,
  date: PropTypes.number.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }),
  ImageData: PropTypes.shape({
    uri: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
  }),
});

export default CommentPropType;
