import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, FormGroup, Label, Input, Button } from 'reactstrap';

import Paginate from 'components/Paginate';
import BlogPost from 'components/BlogPost';
import CSRFForm from 'components/CSRFForm';

const DevBlog = ({ blogs, pages, userid, admin, activePage }) => (
  <div className="mt-3">
    <h3 className="centered">Developer Blog</h3>
    {admin && (
      <Card>
        <CardBody>
          <h5>Create New Blog Post</h5>
          <CSRFForm method="POST" action="/dev/blogpost/">
            <FormGroup>
              <Label>Title:</Label>
              <Input maxlength="200" name="title" type="text" />
            </FormGroup>
            <FormGroup>
              <Label>HTML:</Label>
              <Input name="html" type="textarea" />
            </FormGroup>
            <Button type="submit" color="success" block outline>
              Submit
            </Button>
          </CSRFForm>
        </CardBody>
      </Card>
    )}
    {pages > 1 && (
      <>
        <hr />
        <Paginate count={parseInt(pages, 10)} active={parseInt(activePage, 10)} urlF={(i) => `/dev/blog/${i}`} />
        <hr />
      </>
    )}
    {blogs.length > 0 ? (
      blogs.map((post) => (
        <BlogPost key={post._id} post={post} canEdit={false} userid={userid} loggedIn={userid !== null} />
      ))
    ) : (
      <h5>No developer blogs have been posted.</h5>
    )}
    {pages > 1 && (
      <>
        <hr />
        <Paginate count={parseInt(pages, 10)} active={parseInt(activePage, 10)} urlF={(i) => `/dev/blog/${i}`} />
        <hr />
      </>
    )}
  </div>
);

DevBlog.propTypes = {
  blogs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  userid: PropTypes.string.isRequired,
  admin: PropTypes.bool.isRequired,
};

export default DevBlog;
