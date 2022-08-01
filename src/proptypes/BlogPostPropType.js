import PropTypes from 'prop-types';

const BlogPostPropType = PropTypes.shape({
  ID: PropTypes.string.isRequired,
  BODY: PropTypes.string.isRequired,
  OWNER: PropTypes.string.isRequired,
  DATE: PropTypes.number.isRequired,
  CUBE_ID: PropTypes.string.isRequired,
  TITLE: PropTypes.string.isRequired,
  CHANGELIST_ID: PropTypes.string.isRequired,
});

export default BlogPostPropType;
