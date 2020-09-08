import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Navbar, Nav, NavItem, NavLink, Row, Col } from 'reactstrap';

import Loading from 'pages/Loading';
import PodcastPreview from 'components/PodcastPreview';
import { csrfFetch } from 'utils/CSRF';

const CreatorPodcasts = ({ user }) => {
  const [podcasts, setPodcasts] = useState([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const response = await csrfFetch(`/content/api/podcasts/${user.id}/${page}`);
      if (!response.ok) {
        console.log(response);
      }
      const json = await response.json();

      setPages(json.numResults);
      setPodcasts(json.podcasts);
      setLoading(false);
    };
    fetchData();
  }, [page]);

  const updatePage = (index) => {
    setLoading(true);
    setPage(index);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <Navbar light expand className="usercontrols mb-3">
        <Nav navbar>
          <NavItem>
            <NavLink href="/content/newpodcast" className="clickable">
              Create New Podcast
            </NavLink>
          </NavItem>
        </Nav>
      </Navbar>
      <Row className="px-3">
        {podcasts.map((podcast) => (
          <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
            <PodcastPreview podcast={podcast} />
          </Col>
        ))}
      </Row>
    </>
  );
};

CreatorPodcasts.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
};

export default CreatorPodcasts;
