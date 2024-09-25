import React from 'react';
import { CardBody, CardHeader, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import ContentPropType from 'proptypes/ContentPropType';

import AspectRatioBox from 'components/AspectRatioBox';
import CommentsSection from 'components/CommentsSection';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import Username from 'components/Username';

const Podcast = ({ podcast, episodes }) => {
  return (
    <>
      <CardHeader>
        <h1>{podcast.title}</h1>
        <h6>
          By <Username user={podcast.owner} />
        </h6>
      </CardHeader>
      <Row>
        <Col xs="12" sm="4">
          <AspectRatioBox ratio={1} className="text-ellipsis">
            <img className="w-100" alt={podcast.title} src={podcast.image} />
          </AspectRatioBox>
        </Col>
        <Col xs="12" sm="8">
          <CardBody dangerouslySetInnerHTML={{ __html: podcast.description }} />
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
        <CommentsSection parentType="podcast" parent={podcast.id} collapse={false} />
      </div>
    </>
  );
};
Podcast.propTypes = {
  podcast: ContentPropType.isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})),
};

Podcast.defaultProps = {
  episodes: [],
};

export default Podcast;
