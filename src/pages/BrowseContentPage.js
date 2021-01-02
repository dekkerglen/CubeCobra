import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import ArticlePreview from 'components/ArticlePreview';
import VideoPreview from 'components/VideoPreview';
import Advertisement from 'components/Advertisement';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const BrowseContentPage = ({ user, loginCallback, content }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Advertisement />
      <DynamicFlash />
      <Row>
        <Col xs="12">
          <Row>
            <Col xs="6">
              <h4>Browse Content</h4>
            </Col>
          </Row>
        </Col>
        {content.map((item) => (
          <Col className="mb-3" xs="6" md="4">
            {item.type === 'article' && <ArticlePreview article={item.content} />}
            {item.type === 'video' && <VideoPreview video={item.content} />}
            {item.type === 'episode' && <PodcastEpisodePreview episode={item.content} />}
          </Col>
        ))}
      </Row>
    </MainLayout>
  );
};

BrowseContentPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  content: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

BrowseContentPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(BrowseContentPage);
