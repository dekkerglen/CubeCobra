import React, { useContext } from 'react';
import { Card, CardHeader } from 'reactstrap';

import PropTypes from 'prop-types';
import ContentPropType from 'proptypes/ContentPropType';

import ButtonLink from 'components/ButtonLink';
import DynamicFlash from 'components/DynamicFlash';
import Podcast from 'components/Podcast';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

const PodcastPage = ({ loginCallback, podcast, episodes }) => {
  const user = useContext(UserContext);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="mb-3">
        {user && user.id === podcast.owner.id && (
          <CardHeader>
            <h5>
              {podcast.status !== 'p' && (
                <>
                  <em className="pe-3">*Draft*</em>
                  <ButtonLink color="accent" outline href={`/content/podcast/edit/${podcast.id}`}>
                    Edit
                  </ButtonLink>
                </>
              )}
              <ButtonLink color="primary" outline href={`/content/podcast/update/${podcast.id}`}>
                Fetch Episodes
              </ButtonLink>
            </h5>
          </CardHeader>
        )}
        <Podcast podcast={podcast} episodes={episodes} />
      </Card>
    </MainLayout>
  );
};

PodcastPage.propTypes = {
  loginCallback: PropTypes.string,
  podcast: ContentPropType.isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

PodcastPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(PodcastPage);
