import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

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

interface LandingPageProps {
  featured: Cube[];
  popular: Cube[];
  content: Article[];
  recentDecks: Deck[];
  loginCallback: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ featured, popular, recentDecks, content, loginCallback }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeSearchNavBar />
      <DynamicFlash />
      <Row>
        <Col md={4} sm={6} xs={12} className="mb-4">
          <CubesCard title="Featured Cubes" cubes={featured} lean />
        </Col>
        <Col md={4} sm={6} xs={12}>
          <CubesCard title="Most Popular Cubes" className="mb-4" cubes={popular} />
        </Col>
        <Col md={4} sm={6} xs={12} className="mb-4">
          <Card>
            <CardHeader>
              <h4>Looking for more cubes?</h4>
            </CardHeader>
            <a href="https://luckypaper.co/resources/cube-map/" target="_blank" rel="noopener noreferrer">
              <img className="card-img-top" src="/content/cubemap.png" alt="Cube Map" />
            </a>
            <CardBody>
              <p>
                Discover just how diverse the Cube format can be, themes you never expected, and where your own cube
                fits.
              </p>
            </CardBody>
          </Card>
        </Col>
        <Col md={4} sm={6} xs={12} className="mb-4">
          <Card>
            <CardHeader>
              <h5>Recent Playtest Drafts</h5>
            </CardHeader>
            <CardBody className="p-0">
              {recentDecks.length > 0 ? (
                recentDecks.map((deck) => <DeckPreview key={deck.id} deck={deck} nextURL="/dashboard" canEdit />)
              ) : (
                <p className="m-2">
                  Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                  <a href="https://discord.gg/Hn39bCU">Discord draft exchange?</a>
                </p>
              )}
            </CardBody>
          </Card>
        </Col>
        <Col md={8} sm={6} xs={12} className="mb-4">
          <Row>
            <Col xs="12">
              <Row>
                <Col xs="6">
                  <h5>Latest Content</h5>
                </Col>
                <Col xs="6">
                  <a className="float-end" href="/content/browse">
                    View more...
                  </a>
                </Col>
              </Row>
            </Col>
            {content.map((item: Article) => (
              <Col key={item.id} lg={4} md={6} xs={12} className="mb-4">
                {item.type === 'a' && <ArticlePreview article={item} />}
                {item.type === 'v' && <VideoPreview video={item} />}
                {item.type === 'e' && <PodcastEpisodePreview episode={item} />}
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </MainLayout>
  );
};

export default RenderToRoot(LandingPage);
