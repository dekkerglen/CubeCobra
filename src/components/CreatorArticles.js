import React, { useState, useEffect } from 'react';
import UserPropType from 'proptypes/UserPropType';

import { Navbar, Nav, NavItem, NavLink, Row, Col, CardBody } from 'reactstrap';

import Loading from 'pages/Loading';
import ArticlePreview from 'components/ArticlePreview';
import Paginate from 'components/Paginate';
import { csrfFetch } from 'utils/CSRF';
import useQueryParam from 'hooks/useQueryParam';

const PAGE_SIZE = 24;

const CreatorArticles = ({ user }) => {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useQueryParam('page', '0');
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const response = await csrfFetch(`/content/api/articles/${user.id}/${page}`);
      if (!response.ok) {
        console.log(response);
      }
      const json = await response.json();

      setPages(Math.ceil(json.numResults / PAGE_SIZE));
      setArticles(json.articles);
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
            <NavLink href="/content/newarticle" className="clickable">
              Create New Article
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
          {articles.map((article) => (
            <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
              <ArticlePreview article={article} />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
};

CreatorArticles.propTypes = {
  user: UserPropType.isRequired,
};

export default CreatorArticles;
