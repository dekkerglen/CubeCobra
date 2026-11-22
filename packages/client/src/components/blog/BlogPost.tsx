import React, { useContext } from 'react';

import { EyeIcon, PencilIcon, TrashIcon } from '@primer/octicons-react';
import BlogPostData from '@utils/datatypes/BlogPost';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Datetime from 'components/base/Datetime';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import BlogPostChangelog from 'components/blog/BlogPostChangelog';
import ChangelogCardView from 'components/blog/ChangelogCardView';
import ChangelogViewControls from 'components/blog/ChangelogViewControls';
import CommentsSection from 'components/comments/CommentsSection';
import EditBlogModal from 'components/EditBlogModal';
import Markdown from 'components/Markdown';
import DeleteBlogModal from 'components/modals/DeleteBlogModal';
import Username from 'components/Username';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import useCardsPerRow from 'hooks/useCardsPerRow';
import useChangelogView from 'hooks/useChangelogView';

export interface BlogPostProps {
  post: BlogPostData;
  noScroll?: boolean;
  showCubeImage?: boolean;
  className?: string;
  changelogViewToggle?: boolean;
}

const EditBlogButton = withModal(Button, EditBlogModal);
const DeleteBlogButton = withModal(Button, DeleteBlogModal);

const BlogPost: React.FC<BlogPostProps> = ({
  post,
  className,
  noScroll = false,
  showCubeImage = false,
  changelogViewToggle = false,
}) => {
  const user: User | null = useContext(UserContext);
  const [changelogView, setChangelogView] = useChangelogView();
  const [cardsPerRow, setCardsPerRow] = useCardsPerRow();
  const scrollStyle = noScroll ? {} : { overflow: 'auto', maxHeight: '50vh' };
  const canEdit = user && (typeof post.owner === 'object' ? user.id === post.owner.id : user.id === post.owner);

  const hasChangelist = post.Changelog !== undefined;
  const hasBody = post.body && post.body.length > 0;
  const showToggle = changelogViewToggle && hasChangelist;
  const showCards = showToggle && changelogView === 'cards';

  const title = (
    <Text lg semibold>
      <Flexbox direction="row" justify="between">
        <Link href={`/cube/blog/blogpost/${post.id}`}>{post.title}</Link>
      </Flexbox>
    </Text>
  );

  const subtitle = (
    <Text md className=" text-text-secondary">
      <Username user={post.owner} />
      {' posted to '}
      {post.cube === 'DEVBLOG' ? (
        <Link href="/dev/blog">Developer Blog</Link>
      ) : (
        <Link href={`/cube/list/${post.cube}`}>{post.cubeName}</Link>
      )}
      {' - '}
      <Datetime date={post.date} />
    </Text>
  );

  const actions = (
    <>
      {post.changelist && (
        <Tooltip text="View cube at this point in time" wrapperTag="span">
          <Link href={`/cube/changelog/${post.cube}/${post.changelist}/list`}>
            <Button color="accent">
              <EyeIcon size={16} />
            </Button>
          </Link>
        </Tooltip>
      )}
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
    </>
  );

  return (
    <Card className={className}>
      <CardHeader className="p-2">
        <Flexbox direction="row" gap="2" alignItems="start">
          {showCubeImage && post.cubeImage && (
            <a href={`/cube/list/${post.cube}`} className="shrink-0">
              <img
                src={post.cubeImage.uri}
                alt={`Art by ${post.cubeImage.artist}`}
                title={post.cubeName}
                className="w-20 h-14 rounded object-cover object-top border border-border"
              />
            </a>
          )}
          {showToggle ? (
            // Single-post layout: actions sit beside the title and subtitle on desktop, below them on phones.
            <div className="flex grow min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <Flexbox direction="col" alignItems="start" className="min-w-0">
                {title}
                {subtitle}
              </Flexbox>
              <Flexbox direction="row" gap="2" wrap="wrap" justify="end" className="md:shrink-0">
                <ChangelogViewControls
                  view={changelogView}
                  setView={setChangelogView}
                  cardsPerRow={cardsPerRow}
                  setCardsPerRow={setCardsPerRow}
                />
                {actions}
              </Flexbox>
            </div>
          ) : (
            <Flexbox direction="col" alignItems="start" className="grow min-w-0">
              <Flexbox direction="row" justify="between" className="w-full">
                {title}
                <Flexbox direction="row" gap="2">
                  {actions}
                </Flexbox>
              </Flexbox>
              {subtitle}
            </Flexbox>
          )}
        </Flexbox>
      </CardHeader>
      {showCards && (
        <>
          {hasBody && (
            <div style={scrollStyle}>
              <CardBody>
                <Markdown markdown={post.body} />
              </CardBody>
            </div>
          )}
          <div className={hasBody ? 'border-t border-border' : undefined} style={scrollStyle}>
            <CardBody>
              <ChangelogCardView changelog={post.Changelog ?? {}} cardsPerRow={cardsPerRow} />
            </CardBody>
          </div>
        </>
      )}
      {!showCards && hasChangelist && hasBody && (
        <Row className="gap-0">
          {/* On the single-post page the body comes first on phones, matching the Cards view. */}
          <Col
            xs={12}
            md={4}
            className={
              showToggle
                ? 'order-2 border-t border-border md:order-1 md:border-t-0 md:border-r'
                : 'border-r border-border'
            }
          >
            <div style={scrollStyle}>
              <CardBody>
                <BlogPostChangelog changelog={post.Changelog ?? {}} />
              </CardBody>
            </div>
          </Col>
          <Col xs={12} md={8} className={showToggle ? 'order-1 md:order-2' : undefined}>
            <div style={scrollStyle}>
              <CardBody>
                <Markdown markdown={post.body} />
              </CardBody>
            </div>
          </Col>
        </Row>
      )}
      {!hasChangelist && hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <Markdown markdown={post.body} />
          </CardBody>
        </div>
      )}
      {!showCards && hasChangelist && !hasBody && (
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
        <CommentsSection parentType="blog" parent={post.id} />
      </div>
    </Card>
  );
};

export default BlogPost;
