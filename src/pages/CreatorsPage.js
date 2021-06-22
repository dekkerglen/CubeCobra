import React from 'react';
import PropTypes from 'prop-types';

import { Nav, CardHeader, Card, TabContent, TabPane } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Tab from 'components/Tab';
import CreatorArticles from 'components/CreatorArticles';
import CreatorVideos from 'components/CreatorVideos';
import CreatorPodcasts from 'components/CreatorPodcasts';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CreatorsPage = ({ loginCallback }) => {
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
            <CreatorArticles />
          </TabPane>
          <TabPane tabId="1">
            <CreatorPodcasts />
          </TabPane>
          <TabPane tabId="2">
            <CreatorVideos />
          </TabPane>
        </TabContent>
      </Card>
    </MainLayout>
  );
};

CreatorsPage.propTypes = {
  loginCallback: PropTypes.string,
};

CreatorsPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CreatorsPage);
