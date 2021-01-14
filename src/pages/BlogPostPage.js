import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import BlogPost from 'components/BlogPost';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const BlogPostPage = ({ post, user, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <BlogPost key={post._id} post={post} canEdit={false} userid={user ? user.id : null} loggedIn={user !== null} />
  </MainLayout>
);

BlogPostPage.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

BlogPostPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(BlogPostPage);
