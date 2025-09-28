import React from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import ArticlePreview from 'components/content/ArticlePreview';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import VideoPreview from 'components/content/VideoPreview';
import CubesCard from 'components/cube/CubesCard';
import CubeSearchNavBar from 'components/cube/CubeSearchNavBar';
import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import DailyP1P1Card from 'components/p1p1/DailyP1P1Card';
import RenderToRoot from 'components/RenderToRoot';
import Article from 'datatypes/Article';
import { ContentType } from 'datatypes/Content';
import Cube from 'datatypes/Cube';
import Draft from 'datatypes/Draft';
import Episode from 'datatypes/Episode';
import { P1P1Pack } from 'datatypes/P1P1Pack';
import Video from 'datatypes/Video';
import MainLayout from 'layouts/MainLayout';

interface LandingPageProps {
  featured: Cube[];
  content: Article[];
  recentDecks: Draft[];
  dailyP1P1?: {
    pack: P1P1Pack;
    cube: Cube;
    date?: number;
  };
}

const LandingPage: React.FC<LandingPageProps> = ({ featured, recentDecks, content, dailyP1P1 }) => {
  return (
    <MainLayout>
      <CubeSearchNavBar />
      <DynamicFlash />
      <Row className="mt-2">
        {dailyP1P1 && (
          <Col md={7} sm={12} className="mb-4">
            <DailyP1P1Card pack={dailyP1P1.pack} cube={dailyP1P1.cube} date={dailyP1P1.date} />
          </Col>
        )}
        <Col md={5} sm={12}>
          <Flexbox direction="col" gap="2">
            <CubesCard title="Featured Cubes" cubes={featured} lean>
              <Text lg semibold>
                <CardBody>
                  <Link href="/explore">Explore more Cubes...</Link>
                </CardBody>
              </Text>
            </CubesCard>
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
          </Flexbox>
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
                <Link href="https://discord.gg/YYF9x65Ane">Discord draft exchange?</Link>
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
                  {item.type === ContentType.ARTICLE && <ArticlePreview article={item as Article} />}
                  {item.type === ContentType.VIDEO && <VideoPreview video={item as Video} />}
                  {item.type === ContentType.EPISODE && <PodcastEpisodePreview episode={item as any as Episode} />}
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
