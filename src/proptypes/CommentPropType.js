import PropTypes from 'prop-types';

const CommentPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  timePosted: PropTypes.string.isRequired,
  ownerName: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  parent: PropTypes.string.isRequired,
  parentType: PropTypes.string.isRequired,
  artist: PropTypes.string.isRequired,
  image: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  updated: PropTypes.bool.isRequired,
});

export default CommentPropType;
