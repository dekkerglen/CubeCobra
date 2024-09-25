import React from 'react';
import { Card, CardHeader, Nav, TabContent, TabPane } from 'reactstrap';

import PropTypes from 'prop-types';

import CreatorArticles from 'components/CreatorArticles';
import CreatorPodcasts from 'components/CreatorPodcasts';
import CreatorVideos from 'components/CreatorVideos';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import Tab from 'components/Tab';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

const CreatorsPage = ({ loginCallback, articles, videos, podcasts }) => {
  const [tab, setTab] = useQueryParam('tab', '0');

  return (
    <MainLayout loginCallback={loginCallback}>
      <Card className="pb-3">
        <CardHeader>
          <h5>Content Creator Dashboard</h5>
        </CardHeader>
        <Nav className="mt-3" tabs justified>
          <Tab tab={tab} setTab={setTab} index="0">
            Articles
          </Tab>
          <Tab tab={tab} setTab={setTab} index="1">
            Podcasts
          </Tab>
          <Tab tab={tab} setTab={setTab} index="2">
            Videos
          </Tab>
        </Nav>
        <DynamicFlash />
        <TabContent activeTab={tab}>
          <TabPane tabId="0">
            <CreatorArticles articles={articles.items} lastKey={articles.lastKey} />
          </TabPane>
          <TabPane tabId="1">
            <CreatorPodcasts podcasts={podcasts.items} lastKey={podcasts.lastKey} />
          </TabPane>
          <TabPane tabId="2">
            <CreatorVideos videos={videos.items} lastKey={videos.lastKey} />
          </TabPane>
        </TabContent>
      </Card>
    </MainLayout>
  );
};

CreatorsPage.propTypes = {
  loginCallback: PropTypes.string,
  articles: PropTypes.shape({
    items: PropTypes.arrayOf({}),
    lastKey: PropTypes.shape({}),
  }).isRequired,
  videos: PropTypes.shape({
    items: PropTypes.arrayOf({}),
    lastKey: PropTypes.shape({}),
  }).isRequired,
  podcasts: PropTypes.shape({
    items: PropTypes.arrayOf({}),
    lastKey: PropTypes.shape({}),
  }).isRequired,
};

CreatorsPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CreatorsPage);
