import React from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';

import ArticlePreview from 'components/ArticlePreview';
import CubesCard from 'components/CubesCard';
import CubeSearchNavBar from 'components/CubeSearchNavBar';
import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import RenderToRoot from 'components/RenderToRoot';
import VideoPreview from 'components/VideoPreview';
import Article from 'datatypes/Article';
import Cube from 'datatypes/Cube';
import Deck from 'datatypes/Deck';
import MainLayout from 'layouts/MainLayout';
import Text from 'components/base/Text';
import Link from 'components/base/Link';

interface LandingPageProps {
  featured: Cube[];
  content: Article[];
  recentDecks: Deck[];
  loginCallback: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ featured, recentDecks, content, loginCallback }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeSearchNavBar />
      <DynamicFlash />
      <Row>
        <Col md={6} sm={12} className="mb-4">
          <Flexbox direction="col" gap="2">
            <CubesCard title="Featured Cubes" cubes={featured} lean>
              <Text lg semibold>
                <CardBody>
                  <Link href="/explore">Explore more Cubes...</Link>
                </CardBody>
              </Text>
            </CubesCard>
          </Flexbox>
        </Col>
        <Col md={6} sm={12} className="mb-4">
          <Card>
            <CardHeader>
              <Text semibold xl>
                Looking for more cubes?
              </Text>
            </CardHeader>
            <a href="https://luckypaper.co/resources/cube-map/" target="_blank" rel="noopener noreferrer">
              <img className="w-full" src="/content/cubemap.png" alt="Cube Map" />
            </a>
            <CardBody>
              <Text>
                Discover just how diverse the Cube format can be, themes you never expected, and where your own cube
                fits.
              </Text>
            </CardBody>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={12} className="mb-4">
          <Card>
            <CardHeader>
              <Text semibold xl>
                Recent Drafts
              </Text>
            </CardHeader>
            {recentDecks.length > 0 ? (
              recentDecks.map((deck) => <DeckPreview key={deck.id} deck={deck} nextURL="/dashboard" />)
            ) : (
              <Text md className="m-2">
                Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                <Link href="https://discord.gg/Hn39bCU">Discord draft exchange?</Link>
              </Text>
            )}
          </Card>
        </Col>
        <Col md={9} sm={6} xs={12} className="mb-4">
          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" justify="between" alignItems="center">
              <Text lg semibold>
                Latest Content
              </Text>
              <Link href="/content/browse">View more content...</Link>
            </Flexbox>
            <Row>
              {content.map((item: Article) => (
                <Col key={item.id} xxl={3} lg={4} sm={6} className="mb-4">
                  {item.type === 'a' && <ArticlePreview article={item} />}
                  {item.type === 'v' && <VideoPreview video={item} />}
                  {item.type === 'e' && <PodcastEpisodePreview episode={item} />}
                </Col>
              ))}
              <Col xxl={3} lg={4} sm={6} className="mb-4">
                <Link href="/content/browse">View more content...</Link>
              </Col>
            </Row>
          </Flexbox>
        </Col>
      </Row>
    </MainLayout>
  );
};

export default RenderToRoot(LandingPage);
