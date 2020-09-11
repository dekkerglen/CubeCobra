import React from 'react';
import PropTypes from 'prop-types';

import { CardHeader, Card } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Podcast from 'components/Podcast';
import ButtonLink from 'components/ButtonLink';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const PodcastPage = ({ user, loginCallback, podcast, episodes }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <DynamicFlash />
      <Card className="mb-3">
        {user && user.id === podcast.owner && (
          <CardHeader>
            <h5>
              {podcast.status !== 'published' && (
                <>
                  <em className="pr-3">*Draft*</em>
                  <ButtonLink color="success" outline href={`/content/podcast/edit/${podcast._id}`}>
                    Edit
                  </ButtonLink>
                </>
              )}
              <ButtonLink color="primary" outline href={`/content/podcast/update/${podcast._id}`}>
                Fetch Episodes
              </ButtonLink>
            </h5>
          </CardHeader>
        )}
        <Podcast podcast={podcast} userid={user && user.id} episodes={episodes} />
      </Card>
    </MainLayout>
  );
};

PodcastPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
  podcast: PropTypes.shape({
    title: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

PodcastPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(PodcastPage);
