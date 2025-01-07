import classNames from 'classnames';
import Banner from 'components/Banner';
import CubePreview from 'components/cube/CubePreview';
import CubesCard from 'components/cube/CubesCard';
import DynamicFlash from 'components/DynamicFlash';
import Feed from 'components/Feed';
import RecentDraftsCard from 'components/RecentDraftsCard';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import Button from 'components/base/Button';
import { Card, CardFooter, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import ArticlePreview from 'components/content/ArticlePreview';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import VideoPreview from 'components/content/VideoPreview';
import CreateCubeModal from 'components/modals/CreateCubeModal';
import UserContext from 'contexts/UserContext';
import BlogPost from 'datatypes/BlogPost';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import MainLayout from 'layouts/MainLayout';
import React, { useContext } from 'react';

interface DashboardPageProps {
  posts: BlogPost[];
  decks: Draft[];
  content: any[];
  loginCallback?: string;
  featured?: Cube[];
  lastKey: any;
  lastDeckKey: any;
}

const CreateCubeModalButton = withModal(Button, CreateCubeModal);

const DashboardPage: React.FC<DashboardPageProps> = ({
  posts,
  lastKey,
  lastDeckKey,
  decks,
  loginCallback = '/',
  content,
  featured = [],
}) => {
  const user = useContext(UserContext);
  const cubes = user?.cubes || [];

  // where featured cubes are positioned on the screen
  let featuredPosition;
  if (!user?.hideFeatured) {
    featuredPosition = cubes.length > 2 ? 'right' : 'left';
  }

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Row className="my-2">
        <Col xs={12} md={6} xl={7}>
          <Flexbox direction="col" gap="2">
            <Card>
              <CardHeader>
                <Text semibold lg>
                  Your Cubes
                </Text>
              </CardHeader>
              <Row className="items-center" gutters={0}>
                {cubes.length > 0 ? (
                  cubes.slice(0, 12).map((cube) => (
                    <Col key={cube.id} lg={6} xl={4}>
                      <CubePreview cube={cube} />
                    </Col>
                  ))
                ) : (
                  <Col className={classNames('p-4', 'grid-flow-col')}>
                    <Flexbox direction="col" gap="2" alignItems="start">
                      <span>You don't have any cubes.</span>
                      <CreateCubeModalButton color="primary">Add a new cube?</CreateCubeModalButton>
                    </Flexbox>
                  </Col>
                )}
              </Row>
              {featuredPosition !== 'left' && (
                <CardFooter>{cubes.length > 2 && <Link href={`/user/view/${user?.id}`}>View All</Link>}</CardFooter>
              )}
            </Card>
            {featuredPosition === 'left' && (
              <CubesCard
                title="Featured Cubes"
                cubes={featured}
                lean
                sideLink={{
                  href: '/donate',
                  text: 'Learn more...',
                }}
              />
            )}
            <Feed items={posts} lastKey={lastKey} />
          </Flexbox>
        </Col>
        <Col xs={12} md={6} xl={5}>
          {featuredPosition === 'right' && (
            <CubesCard
              className="mb-4"
              title="Featured Cubes"
              cubes={featured}
              lean
              header={{ hLevel: 5, sideLink: '/donate', sideText: 'Learn more...' }}
            />
          )}
          <RecentDraftsCard decks={decks} lastKey={lastDeckKey} />
          <Col className="d-none d-md-block mt-3" md={4}>
            <Flexbox direction="col" gap="2">
              <Flexbox direction="row" justify="between">
                <Text semibold lg>
                  Latest Content
                </Text>
                <Link href="/content/browse">View more...</Link>
              </Flexbox>
              <Row>
                {content.map((item) => (
                  <Col key={item.id} className="mb-3" xs={6}>
                    {item.type === 'a' && <ArticlePreview article={item} />}
                    {item.type === 'v' && <VideoPreview video={item} />}
                    {item.type === 'e' && <PodcastEpisodePreview episode={item} />}
                  </Col>
                ))}
              </Row>
            </Flexbox>
          </Col>
        </Col>
      </Row>
    </MainLayout>
  );
};

export default RenderToRoot(DashboardPage);
