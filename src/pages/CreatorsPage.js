import React, { useState } from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Nav, CardHeader, Card, TabContent, TabPane } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Tab from 'components/Tab';
import CreatorArticles from 'components/CreatorArticles';
import CreatorVideos from 'components/CreatorVideos';
import CreatorPodcasts from 'components/CreatorPodcasts';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CreatorsPage = ({ user, loginCallback }) => {
  const [tab, setTab] = useState('0');

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
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
            <CreatorArticles user={user} />
          </TabPane>
          <TabPane tabId="1">
            <CreatorPodcasts user={user} />
          </TabPane>
          <TabPane tabId="2">
            <CreatorVideos user={user} />
          </TabPane>
        </TabContent>
      </Card>
    </MainLayout>
  );
};

CreatorsPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CreatorsPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CreatorsPage);
