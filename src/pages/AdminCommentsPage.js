import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Comment from 'components/Comment';

const PAGE_SIZE = 24;

const AdminCommentsPage = ({ user, loginCallback, comments, count, page }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Comment Reports</h5>
        {count > PAGE_SIZE ? (
          <>
            <h6>
              {`Displaying ${PAGE_SIZE * page + 1}-${Math.min(count, PAGE_SIZE * (page + 1))} of ${count} Comments`}
            </h6>
            <Paginate
              count={Math.ceil(count / PAGE_SIZE)}
              active={parseInt(page, 10)}
              urlF={(i) => `/admin/comments/${i}`}
            />
          </>
        ) : (
          <h6>{`Displaying all ${count} Comments`}</h6>
        )}
      </CardHeader>
      {comments.map((comment) => (
        <Comment comment={comment} userid={user && user.id} index={0} noReplies editComment={() => {}} />
      ))}
    </Card>
  </MainLayout>
);

AdminCommentsPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
  comments: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

AdminCommentsPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(AdminCommentsPage);
