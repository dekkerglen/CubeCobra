import React from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';
import UserPropType from 'proptypes/UserPropType';

import BlogPost from 'components/BlogPost';
import CubePreview from 'components/CubePreview';
import ArticlePreview from 'components/ArticlePreview';
import DeckPreview from 'components/DeckPreview';
import VideoPreview from 'components/VideoPreview';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import withModal from 'components/WithModal';
import CreateCubeModal from 'components/CreateCubeModal';

import { Button, Card, Col, Row, CardHeader, CardBody, CardFooter } from 'reactstrap';
import CubesCard from 'components/CubesCard';

const CreateCubeModalButton = withModal(Button, CreateCubeModal);

const DashboardPage = ({ posts, cubes, decks, user, loginCallback, content, featured }) => {
  const filteredDecks = cubes.length > 2 ? decks.slice(0, 4) : decks;

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Advertisement />
      <DynamicFlash />
      <Row className="mt-3">
        <Col xs="12" md="6">
          <Card>
            <CardHeader>
              <h5>Your Cubes</h5>
            </CardHeader>
            <CardBody className="p-0">
              <Row className="no-gutters">
                {cubes.length > 0 ? (
                  cubes.slice(0, 4).map((cube) => (
                    <Col key={cube._id} xs="12" sm="12" md="12" lg="6">
                      <CubePreview cube={cube} />
                    </Col>
                  ))
                ) : (
                  <p className="m-2">
                    You don't have any cubes.{' '}
                    <CreateCubeModalButton color="success">Add a new cube?</CreateCubeModalButton>
                  </p>
                )}
              </Row>
            </CardBody>
            <CardFooter>{cubes.length > 2 && <a href={`/user/view/${cubes[0].owner}`}>View All</a>}</CardFooter>
          </Card>
        </Col>
        <Col xs="12" md="6">
          <CubesCard
            className="mb-4"
            title="Featured Cubes"
            cubes={featured}
            lean
            header={{ hLevel: 5, sideLink: '/donate', sideText: 'Learn more...' }}
          />
          <Card>
            <CardHeader>
              <h5>Recent Drafts of Your Cubes</h5>
            </CardHeader>
            <CardBody className="p-0">
              {decks.length > 0 ? (
                filteredDecks.map((deck) => <DeckPreview key={deck._id} deck={deck} nextURL="/dashboard" canEdit />)
              ) : (
                <p className="m-2">
                  Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                  <a href="https://discord.gg/Hn39bCU">Discord draft exchange?</a>
                </p>
              )}
            </CardBody>
            <CardFooter>
              <a href="/dashboard/decks/0">View All</a>
            </CardFooter>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col xs="12" md="8">
          <h4 className="mt-4">Feed</h4>
          {posts.length > 0 ? (
            posts.map((post) => (
              <BlogPost key={post._id} post={post} canEdit={false} userid={user ? user.id : null} loggedIn />
            ))
          ) : (
            <p>
              No posts to show. <a href="/explore">Find some cubes</a> to follow!
            </p>
          )}
        </Col>
        <Col className="d-none d-md-block mt-3" md="4">
          <Row>
            <Col xs="12">
              <Row>
                <Col xs="6">
                  <h5>Latest Content</h5>
                </Col>
                <Col xs="6">
                  <a className="float-right" href="/content/browse">
                    View more...
                  </a>
                </Col>
              </Row>
            </Col>
            {content.map((item) => (
              <Col className="mb-3" xs="12">
                {item.type === 'article' && <ArticlePreview article={item.content} />}
                {item.type === 'video' && <VideoPreview video={item.content} />}
                {item.type === 'episode' && <PodcastEpisodePreview episode={item.content} />}
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </MainLayout>
  );
};

DashboardPage.propTypes = {
  posts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  user: UserPropType,
  content: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  loginCallback: PropTypes.string,
  featured: PropTypes.arrayOf(CubePropType),
};

DashboardPage.defaultProps = {
  user: null,
  loginCallback: '/',
  featured: [],
};

export default RenderToRoot(DashboardPage);
