import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardHeader, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const BlogPostPage = ({ user, title, error, requestId, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h4>{title}</h4>
      </CardHeader>
      <CardBody>
        <p>
          If you think this was a mistake, please report this on the{' '}
          <a href="https://discord.gg/Hn39bCU">Cube Cobra Discord</a>
        </p>
        {error && (
          <p>
            {' '}
            <code>{error}</code>
          </p>
        )}
        {requestId && (
          <p>
            Request ID: <code>{requestId}</code>
          </p>
        )}
      </CardBody>
    </Card>
  </MainLayout>
);

BlogPostPage.propTypes = {
  user: UserPropType,
  title: PropTypes.string.isRequired,
  requestId: PropTypes.string,
  error: PropTypes.string,
  loginCallback: PropTypes.string,
};

BlogPostPage.defaultProps = {
  user: null,
  loginCallback: '/',
  requestId: null,
  error: null,
};

export default RenderToRoot(BlogPostPage);
