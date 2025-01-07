import React, { useContext } from 'react';

import TimeAgo from 'react-timeago';

import { PencilIcon, TrashIcon } from '@primer/octicons-react';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import CommentsSection from 'components/comments/CommentsSection';
import EditBlogModal from 'components/EditBlogModal';
import DeleteBlogModal from 'components/modals/DeleteBlogModal';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import BlogPostData from 'datatypes/BlogPost';
import User from 'datatypes/User';
export interface BlogPostProps {
  post: BlogPostData;
  noScroll?: boolean;
  className?: string;
}

const EditBlogButton = withModal(Button, EditBlogModal);
const DeleteBlogButton = withModal(Button, DeleteBlogModal);

const BlogPost: React.FC<BlogPostProps> = ({ post, className, noScroll = false }) => {
  const user: User | null = useContext(UserContext);
  const scrollStyle = noScroll ? {} : { overflow: 'auto', maxHeight: '50vh' };
  const canEdit = user && (typeof post.owner === 'object' ? user.id === post.owner.id : user.id === post.owner);

  const hasChangelist = post.Changelog !== undefined;
  const hasBody = post.body && post.body.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="p-2">
        <Flexbox direction="col" alignItems="start">
          <Flexbox direction="row" justify="between" className="w-full">
            <Text lg semibold>
              <Flexbox direction="row" justify="between">
                <Link href={`/cube/blog/blogpost/${post.id}`}>{post.title}</Link>
              </Flexbox>
            </Text>
            <Flexbox direction="row" gap="2">
              {canEdit && (
                <>
                  <EditBlogButton color="primary" modalprops={{ cubeID: post.cube, post }}>
                    <PencilIcon size={16} />
                  </EditBlogButton>
                  <DeleteBlogButton color="danger" modalprops={{ post }}>
                    <TrashIcon size={16} />
                  </DeleteBlogButton>
                </>
              )}
            </Flexbox>
          </Flexbox>
          <Text md className=" text-text-secondary">
            <Username user={post.owner} />
            {' posted to '}
            {post.cube === 'DEVBLOG' ? (
              <Link href="/dev/blog">Developer Blog</Link>
            ) : (
              <Link href={`/cube/overview/${post.cube}`}>{post.cubeName}</Link>
            )}
            {' - '}
            <TimeAgo date={post.date} />
          </Text>
        </Flexbox>
      </CardHeader>
      {hasChangelist && hasBody && (
        <Row className="gap-0">
          <Col xs={12} md={4} className="border-r border-border">
            <div style={scrollStyle}>
              <CardBody>
                <BlogPostChangelog changelog={post.Changelog ?? {}} />
              </CardBody>
            </div>
          </Col>
          <Col xs={12} md={8}>
            <div style={scrollStyle}>
              <CardBody>
                <Markdown markdown={post.body} limited />
              </CardBody>
            </div>
          </Col>
        </Row>
      )}
      {!hasChangelist && hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <Markdown markdown={post.body} limited />
          </CardBody>
        </div>
      )}
      {hasChangelist && !hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <BlogPostChangelog changelog={post.Changelog ?? {}} />
          </CardBody>
        </div>
      )}
      {!hasChangelist && !hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <Text md semibold>
              Uh oh, there doesn't seem to be anything here.
            </Text>
          </CardBody>
        </div>
      )}
      <div className="border-t border-border">
        <CommentsSection parentType="blog" parent={post.id} collapse={false} comments={post.comments} />
      </div>
    </Card>
  );
};

export default BlogPost;
