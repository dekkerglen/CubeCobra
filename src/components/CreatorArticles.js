import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Navbar, Nav, NavItem, NavLink, Row, Col } from 'reactstrap';

import Loading from 'pages/Loading';
import ArticlePreview from 'components/ArticlePreview';
import { csrfFetch } from 'utils/CSRF';

const CreatorArticles = ({ user }) => {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const response = await csrfFetch(`/content/api/articles/${user.id}/${page}`);
      if (!response.ok) {
        console.log(response);
      }
      const json = await response.json();

      setPages(json.numResults);
      setArticles(json.articles);
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
            <NavLink href="/content/newarticle" className="clickable">
              Create New Article
            </NavLink>
          </NavItem>
        </Nav>
      </Navbar>
      <Row className="px-3">
        {articles.map((article) => (
          <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
            <ArticlePreview article={article} />
          </Col>
        ))}
      </Row>
    </>
  );
};

CreatorArticles.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
};

export default CreatorArticles;
