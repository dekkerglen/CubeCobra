import PropTypes from 'prop-types';

const BlogPostPropType = PropTypes.shape({
  Id: PropTypes.string.isRequired,
  Body: PropTypes.string.isRequired,
  Owner: PropTypes.string.isRequired,
  Date: PropTypes.string.isRequired,
  Title: PropTypes.string,
  CubeId: PropTypes.string.isRequired,
  ChangelistId: PropTypes.string,
});

export default BlogPostPropType;
