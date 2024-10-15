import React, { useContext, useState } from 'react';

import TimeAgo from 'react-timeago';

import BlogContextMenu from 'components/blog/BlogContextMenu';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import CommentsSection from 'components/comments/CommentsSection';
import EditBlogModal from 'components/EditBlogModal';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import UserContext from 'contexts/UserContext';
import BlogPostData from 'datatypes/BlogPost';
import User from 'datatypes/User';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import Link from 'components/base/Link';
export interface BlogPostProps {
  post: BlogPostData;
  noScroll?: boolean;
  className?: string;
}

const BlogPost: React.FC<BlogPostProps> = ({ post, className, noScroll = false }) => {
  const user: User | null = useContext(UserContext);
  const [editOpen, setEditOpen] = useState(false);
  const scrollStyle = noScroll ? {} : { overflow: 'auto', maxHeight: '50vh' };
  const canEdit = user && user.id === post.owner;

  const hasChangelist = post.Changelog !== undefined;
  const hasBody = post.body && post.body.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pl-4 pr-0 pt-2 pb-0">
        <Text lg semibold>
          <Flexbox direction="row" justify="between">
            <Link href={`/cube/blog/blogpost/${post.id}`}>{post.title}</Link>
            {canEdit && (
              <Flexbox direction="row">
                <BlogContextMenu post={post} value="..." onEdit={() => setEditOpen(true)} />
                <EditBlogModal
                  isOpen={editOpen}
                  toggle={() => setEditOpen((open) => !open)}
                  post={post}
                  cubeID={post.cube}
                />
              </Flexbox>
            )}
          </Flexbox>
        </Text>
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
            <h5>Uh oh, there doesn't seem to be anything here.</h5>
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
