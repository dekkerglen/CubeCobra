import { useState } from 'react';
import PropTypes from 'prop-types';
import CommentPropType from 'proptypes/CommentPropType';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardHeader } from 'reactstrap';

import Comment from 'components/Comment';
import DynamicFlash from 'components/DynamicFlash';
import CommentsSection from 'components/CommentsSection';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Advertisement from 'components/Advertisement';

const translateType = {
  comment: 'Comment',
  blog: 'Blog Post',
  deck: 'Drafted Deck',
  card: 'Card Page',
  article: 'Article',
  podcast: 'Podcast',
  video: 'Video',
  episode: 'Podcast Epsiode',
};

const translateLink = {
  comment: (id) => `/comment/${id}`,
  blog: (id) => `/cube/blogpost/${id}`,
  deck: (id) => `/cube/deck/${id}`,
  card: (id) => `/tool/card/${id}`,
  article: (id) => `/content/article/${id}`,
  video: (id) => `/content/video/${id}`,
  podcast: (id) => `/content/podcast/${id}`,
  episode: (id) => `/content/episode/${id}`,
};

const CommentPage = ({ comment, user, loginCallback }) => {
  const [content, setContent] = useState(comment);

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Advertisement />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <a href={translateLink[content.parentType](content.parent)}>
            {`Responding to this ${translateType[content.parentType]}`}
          </a>
        </CardHeader>
        <Comment comment={content} userid={user && user.id} index={0} noReplies editComment={setContent} />
        <div className="border-top">
          <CommentsSection parentType="comment" parent={content._id} userid={user && user.id} />
        </div>
      </Card>
    </MainLayout>
  );
};

CommentPage.propTypes = {
  comment: CommentPropType.isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CommentPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CommentPage);
