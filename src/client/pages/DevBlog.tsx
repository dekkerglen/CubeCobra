import React, { useCallback, useContext, useState } from 'react';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody } from 'components/base/Card';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import BlogPost from 'components/blog/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import TextEntry from 'components/TextEntry';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

interface DevBlogEntryProps {
  items: any[];
  setItems: (items: any[]) => void;
}

interface DevBlogProps {
  blogs: any[];
  lastKey: string | null;
  loginCallback?: string;
}

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const DevBlogEntry: React.FC<DevBlogEntryProps> = ({ items, setItems }) => {
  const { csrfFetch } = useContext(CSRFContext);
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
        console.error(json);
      }
    } else {
      console.error(response);
    }
  }, [title, body, setItems, items]);

  return (
    <Card className="my-3">
      <CardBody>
        <Text semibold lg>
          Create New Blog Post
        </Text>
        <Input label="Title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Text semibold md>
          Body:
        </Text>
        <TextEntry name="blog" value={body} setValue={setBody} maxLength={10000} />
        <Button color="primary" block outline onClick={submit}>
          Submit
        </Button>
      </CardBody>
    </Card>
  );
};

const DevBlog: React.FC<DevBlogProps> = ({ blogs, lastKey, loginCallback = '/' }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState(blogs);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const user = useContext(UserContext);
  const [loading, setLoading] = useState(false);

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

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
    setLoading(false);
  }, [items, setItems, currentLastKey]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Flexbox direction="col" gap="2" className="my-2">
        <Banner />
        <DynamicFlash />
        <Text semibold lg>
          Developer Blog
        </Text>
        {user && user.roles && user.roles.includes('Admin') && <DevBlogEntry items={items} setItems={setItems} />}
        {items.map((post) => (
          <BlogPost key={post.id} post={post} />
        ))}
        {loading && loader}
        {!loading && currentLastKey && (
          <Button color="primary" block onClick={fetchMoreData}>
            Load More
          </Button>
        )}
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(DevBlog);
