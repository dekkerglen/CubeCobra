import React from 'react';
import PropTypes from 'prop-types';

import CommentsSection from 'components/CommentsSection';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import AspectRatioBox from 'components/AspectRatioBox';

import { CardBody, CardHeader, Row, Col } from 'reactstrap';

const Podcast = ({ podcast, userid, episodes }) => {
  return (
    <>
      <CardHeader>
        <h1>{podcast.title}</h1>
        <h6>
          By <a href={`/user/view/${podcast.owner}`}>{podcast.username}</a>
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
        <CommentsSection parentType="podcast" parent={podcast._id} userid={userid} collapse={false} />
      </div>
    </>
  );
};
Podcast.propTypes = {
  podcast: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
  }).isRequired,
  episodes: PropTypes.arrayOf(PropTypes.shape({})),
  userid: PropTypes.string,
};

Podcast.defaultProps = {
  userid: null,
  episodes: [],
};

export default Podcast;
