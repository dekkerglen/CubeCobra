import React from 'react';
import PropTypes from 'prop-types';

import BlogPost from 'components/BlogPost';
import PagedList from 'components/PagedList';
import CubePreview from 'components/CubePreview';
import DeckPreview from 'components/DeckPreview';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

import { Button, Card, Col, Row, CardHeader, CardBody, CardFooter } from 'reactstrap';

const DashboardPage = ({ posts, cubes, decks, canEdit, user }) => (
  <MainLayout user={user}>
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
                  <Button data-toggle="modal" data-target="#cubeModal" color="success">
                    Add a new cube?
                  </Button>
                </p>
              )}
            </Row>
          </CardBody>
          <CardFooter>{cubes.length > 2 && <a href={`/user/view/${cubes[0].owner}`}>View All</a>}</CardFooter>
        </Card>
      </Col>
      <Col xs="12" md="6">
        <Card>
          <CardHeader>
            <h5>Recent Drafts of Your Cubes</h5>
          </CardHeader>
          <CardBody className="p-0">
            {decks.length > 0 ? (
              decks.map((deck) => <DeckPreview key={deck._id} deck={deck} nextURL="/dashboard" canEdit={canEdit} />)
            ) : (
              <p className="m-2">
                Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                <a href="https://discord.gg/Hn39bCU">Discord draft exchange?</a>
              </p>
            )}
          </CardBody>
          <CardFooter>{cubes.length > 2 && <a href="/dashboard/decks/0">View All</a>}</CardFooter>
        </Card>
      </Col>
      <Col xs="12" className="mb-2 mt-4">
        <Card>
          <CardHeader>
            <h4>Feed</h4>
          </CardHeader>
        </Card>
        {posts.length > 0 ? (
          <PagedList
            pageSize={10}
            showBottom
            rows={posts.slice(0).map((post) => (
              <BlogPost key={post._id} post={post} canEdit={false} userid={user.id} loggedIn />
            ))}
          />
        ) : (
          <p>
            No posts to show. <a href="/explore">Find some cubes</a> to follow!
          </p>
        )}
      </Col>
    </Row>
  </MainLayout>
);

DashboardPage.propTypes = {
  posts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      owner: PropTypes.string.isRequired,
    }),
  ).isRequired,
  decks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  canEdit: PropTypes.bool.isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

DashboardPage.defaultProps = {
  user: null,
};

export default RenderToRoot(DashboardPage);
