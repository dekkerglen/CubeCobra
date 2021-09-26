import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import { Collapse, Nav, Navbar, NavItem, NavLink } from 'reactstrap';

import BlogPost from 'components/BlogPost';
import EditBlogModal from 'components/EditBlogModal';
import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CubeBlogPage = ({ cube, pages, activePage, posts, loginCallback }) => {
  const [isNewEditOpen, setNewEditOpen] = useState(false);

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="blog">
        <Navbar expand light className="usercontrols mb-3">
          <Collapse navbar>
            <Nav navbar>
              <NavItem>
                <NavLink onClick={() => setNewEditOpen(true)} href="#">
                  Create new blog post
                </NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
        <DynamicFlash />
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/blog/${cube._id}/${i}`} />}
        {posts.length > 0 ? (
          posts.map((post) => <BlogPost key={post._id} post={post} />)
        ) : (
          <h5>No blog posts for this cube.</h5>
        )}
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/blog/${cube._id}/${i}`} />}
        <EditBlogModal toggle={() => setNewEditOpen((open) => !open)} isOpen={isNewEditOpen} cubeID={cube._id} />
      </CubeLayout>
    </MainLayout>
  );
};

CubeBlogPage.propTypes = {
  cube: CubePropType.isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      markdown: PropTypes.string,
    }),
  ).isRequired,
  loginCallback: PropTypes.string,
};

CubeBlogPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeBlogPage);
