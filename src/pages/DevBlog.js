import React, { useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, FormGroup, Label, Input, Button, Spinner } from 'reactstrap';

import UserContext from 'contexts/UserContext';
import BlogPost from 'components/BlogPost';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Banner from 'components/Banner';
import TextEntry from 'components/TextEntry';
import DynamicFlash from 'components/DynamicFlash';
import InfiniteScroll from 'react-infinite-scroll-component';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

// eslint-disable-next-line react/prop-types
const DevBlogEntry = ({ items, setItems }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const submit = useCallback(async () => {
    const response = await csrfFetch(`/dev/blogpost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([json.blogpost, ...items]);
        setTitle('');
        setBody('');
      } else {
        console.log(json);
      }
    } else {
      console.log(response);
    }
  }, [title, body, setItems, items]);

  return (
    <Card className="my-3">
      <CardBody>
        <h5>Create New Blog Post</h5>
        <FormGroup>
          <Label>title:</Label>
          <Input maxLength="200" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormGroup>
        <FormGroup>
          <Label>body:</Label>
          <TextEntry name="blog" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} />
        </FormGroup>
        <Button color="accent" block outline onClick={submit}>
          Submit
        </Button>
      </CardBody>
    </Card>
  );
};

const DevBlog = ({ blogs, lastKey, loginCallback }) => {
  const [items, setItems] = useState(blogs);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const user = useContext(UserContext);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/dev/getmoreblogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.blogs]);
        setLastKey(json.lastKey);
      }
    }
  }, [items, setItems, currentLastKey]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <div className="mt-3">
        <h3>Developer Blog</h3>
        {user && user.roles && user.roles.includes('Admin') && <DevBlogEntry items={items} setItems={setItems} />}
        <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey != null} loader={loader}>
          {items.map((post) => (
            <BlogPost key={post.id} post={post} />
          ))}
        </InfiniteScroll>
      </div>
    </MainLayout>
  );
};

DevBlog.propTypes = {
  blogs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.shape({}),
  loginCallback: PropTypes.string,
};

DevBlog.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(DevBlog);
