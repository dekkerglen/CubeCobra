import ArticlePreview from 'components/content/ArticlePreview';
import Banner from 'components/Banner';
import CreateCubeModal from 'components/modals/CreateCubeModal';
import CubePreview from 'components/CubePreview';
import CubesCard from 'components/CubesCard';
import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import Feed from 'components/Feed';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import RenderToRoot from 'components/RenderToRoot';
import VideoPreview from 'components/content/VideoPreview';
import withModal from 'components/WithModal';
import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import UserContext from 'contexts/UserContext';
import BlogPost from 'datatypes/BlogPost';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import MainLayout from 'layouts/MainLayout';
import React, { useContext } from 'react';
import classNames from 'classnames';

interface DashboardPageProps {
  posts: BlogPost[];
  decks: Draft[];
  content: any[];
  loginCallback?: string;
  featured?: Cube[];
  lastKey?: string;
}

const CreateCubeModalButton = withModal(Button, CreateCubeModal);

const DashboardPage: React.FC<DashboardPageProps> = ({
  posts,
  lastKey,
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

  // the number of drafted decks shown, based on where cubes are located
  let filteredDecks = decks;
  if (featuredPosition === 'right') {
    filteredDecks = decks.slice(0, 8);
  }
  if (!featuredPosition && cubes.length <= 2) {
    filteredDecks = decks.slice(0, 12);
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
              <Row className="items-center" noGutters>
                {cubes.length > 0 ? (
                  cubes.slice(0, 12).map((cube) => (
                    <Col key={cube.id} lg={6} xl={4}>
                      <CubePreview cube={cube} />
                    </Col>
                  ))
                ) : (
                  <Col className={classNames('p-4', 'grid-flow-col')}>
                    <span>You don't have any cubes.</span>
                    <CreateCubeModalButton color="accent">Add a new cube?</CreateCubeModalButton>
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
            <Text className="mt-3" semibold lg>
              Feed
            </Text>
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
          <Card>
            <CardHeader>
              <Text semibold lg>
                Recent Drafts of Your Cubes
              </Text>
            </CardHeader>
            {decks.length > 0 ? (
              filteredDecks.map((deck) => <DeckPreview key={deck.id} deck={deck} nextURL="/dashboard" />)
            ) : (
              <CardBody>
                <Text>
                  Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                  <Link href="https://discord.gg/Hn39bCU">Discord draft exchange?</Link>
                </Text>
              </CardBody>
            )}
            <CardFooter>
              <Link href="/dashboard/decks">View All</Link>
            </CardFooter>
          </Card>
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
