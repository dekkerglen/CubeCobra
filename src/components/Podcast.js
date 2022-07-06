import React from 'react';

import PropTypes from 'prop-types';
import PodcastPropType from 'proptypes/PodcastPropType';

import CommentsSection from 'components/CommentsSection';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import AspectRatioBox from 'components/AspectRatioBox';
import Username from 'components/Username';

import { CardBody, CardHeader, Row, Col } from 'reactstrap';

const Podcast = ({ podcast, episodes }) => {
  return (
    <>
      <CardHeader>
        <h1>{podcast.Title}</h1>
        <h6>
          By <Username userId={podcast.Owner} defaultName={podcast.Username} />
        </h6>
      </CardHeader>
      <Row>
        <Col xs="12" sm="4">
          <AspectRatioBox ratio={1} className="text-ellipsis">
            <img className="w-100" alt={podcast.Title} src={podcast.Image} />
          </AspectRatioBox>
        </Col>
        <Col xs="12" sm="8">
          <CardBody dangerouslySetInnerHTML={{ __html: podcast.Description }} />
        </Col>
      </Row>
      <CardBody className="border-top">
        {episodes.length <= 0 ? (
          <p>No episodes available. Check back later for new episodes!</p>
        ) : (
          <Row>
            {episodes.map((episode) => (
              <Col xs="12" sm="6" md="3" className="pb-3">
                <PodcastEpisodePreview episode={episode} />
              </Col>
            ))}
          </Row>
        )}
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="podcast" parent={podcast.Id} collapse={false} />
      </div>
    </>
  );
};
Podcast.propTypes = {
  podcast: PodcastPropType.isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})),
};

Podcast.defaultProps = {
  episodes: [],
};

export default Podcast;
