import React, { useState, useEffect, useContext } from 'react';

import UserContext from 'contexts/UserContext';
import { Navbar, Nav, NavItem, NavLink, Row, Col, CardBody } from 'reactstrap';
import Loading from 'pages/Loading';
import VideoPreview from 'components/VideoPreview';
import Paginate from 'components/Paginate';
import useQueryParam from 'hooks/useQueryParam';
import { csrfFetch } from 'utils/CSRF';

const PAGE_SIZE = 24;

const CreatorVideos = () => {
  const user = useContext(UserContext);

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useQueryParam('page', 0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const response = await csrfFetch(`/content/api/videos/${user.id}/${page}`);
      if (!response.ok) {
        console.log(response);
      }
      const json = await response.json();

      setPages(Math.ceil(json.numResults / PAGE_SIZE));
      setVideos(json.videos);
      setLoading(false);
    };
    fetchData();
  }, [page, user]);

  const updatePage = (index) => {
    setLoading(true);
    setPage(index);
  };

  return (
    <>
      <Navbar light expand className="usercontrols mb-3">
        <Nav navbar>
          <NavItem>
            <NavLink href="/content/newvideo" className="clickable">
              Create New Video
            </NavLink>
          </NavItem>
        </Nav>
      </Navbar>
      {pages > 1 && (
        <CardBody className="pt-0">
          <Paginate count={pages} active={page} onClick={(i) => updatePage(i)} />
        </CardBody>
      )}
      {loading ? (
        <Loading />
      ) : (
        <Row className="px-3">
          {videos.map((video) => (
            <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
              <VideoPreview video={video} />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
};

export default CreatorVideos;
