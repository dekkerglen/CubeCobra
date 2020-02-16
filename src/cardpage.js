import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import {
  Card,
  CardHeader,
  Row,
  Col,
  CardBody,
  Table,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
} from 'reactstrap';

import ImageFallback from 'components/ImageFallback';
import ButtonLink from 'components/ButtonLink';
import CountTableRow from 'components/CountTableRow';
import CubePreview from 'components/CubePreview';

import { getTCGLink } from 'utils/Affiliate';
import { encodeName } from 'utils/Card';

class CardPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTab: '1',
    };
    this.changeTab = this.changeTab.bind(this);
  }

  changeTab(tab) {
    this.setState({
      selectedTab: tab,
    });
  }

  render() {
    const { card, data, prices, related, cubes } = this.props;
    const { selectedTab } = this.state;
    return (
      <Card>
        <CardHeader>
          <h4>
            {card.name}
            <div className="float-right">
              <ButtonLink className="mx-2" color="success" href={card.scryfall_uri}>
                <span className="d-none d-sm-inline">View on Scryfall</span>
                <span className="d-sm-none">Scryfall</span>
              </ButtonLink>
              <ButtonLink className="mx-2" color="secondary" href={getTCGLink({ details: card })}>
                Buy
              </ButtonLink>
            </div>
          </h4>
        </CardHeader>
        <CardBody>
          <Row>
            <Col xs="12" sm="4">
              <ImageFallback
                className="w-100"
                src={card.image_normal}
                fallbackSrc="/content/default_card.png"
                alt={card.name}
              />
              <div className="price-area">
                {prices[card.tcgplayer_id] && (
                  <div className="card-price">TCGPlayer Market: {prices[card.tcgplayer_id].toFixed(2)}</div>
                )}
                {prices[`${card.tcgplayer_id}_foil`] && (
                  <div className="card-price">
                    Foil TCGPlayer Market: {prices[`${card.tcgplayer_id}_foil`].toFixed(2)}
                  </div>
                )}
                {card.elo && <div className="card-price">Elo: {card.elo}</div>}
              </div>
            </Col>
            <Col className="breakdown" xs="12" sm="8">
              <p>
                Played in
                {Math.round(data.total[1] * 1000.0) / 10}%<span className="percent">{data.total[0]}</span>
                Cubes total.
              </p>
              <Row>
                <Col xs="12" sm="6" md="6" lg="6">
                  <h5>By Legality:</h5>
                  <Table bordered>
                    <tbody>
                      <CountTableRow label="Vintage" value={data.vintage} />
                      <CountTableRow label="Legacy" value={data.legacy} />
                      <CountTableRow label="Modern" value={data.modern} />
                      <CountTableRow label="Standard" value={data.standard} />
                      <CountTableRow label="Pauper" value={data.pauper} />
                    </tbody>
                  </Table>
                </Col>
                <Col xs="12" sm="6" md="6" lg="6">
                  <h5>By Size:</h5>
                  <Table bordered>
                    <tbody>
                      <CountTableRow label="1-180" value={data.size180} />
                      <CountTableRow label="181-360" value={data.size360} />
                      <CountTableRow label="361-450" value={data.size450} />
                      <CountTableRow label="451-540" value={data.size540} />
                      <CountTableRow label="541+" value={data.size720} />
                    </tbody>
                  </Table>
                </Col>
              </Row>
            </Col>
          </Row>
        </CardBody>
        <Nav tabs>
          <NavItem>
            <NavLink
              className={selectedTab === '1' ? 'active mx-2' : 'mx-2 clickable'}
              onClick={() => {
                this.changeTab('1');
              }}
            >
              Often Drafted With
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={selectedTab === '2' ? 'active mx-2' : 'mx-2 clickable'}
              onClick={() => {
                this.changeTab('2');
              }}
            >
              Cubes With This Card
            </NavLink>
          </NavItem>
        </Nav>
        <TabContent activeTab={selectedTab}>
          <TabPane tabId="1">
            <CardBody>
              <Row>
                {related.map((item) => (
                  <a key={item.name} href={`/tool/card/${encodeName(item.name)}`}>
                    <img width="150" height="210" alt={item.name} src={item.image_normal} />
                  </a>
                ))}
              </Row>
            </CardBody>
          </TabPane>
          <TabPane tabId="2">
            <Row className="no-gutters">
              {cubes.length > 0 ? (
                cubes.map(
                  (cube) =>
                    cube && (
                      <Col key={cube._id} xs="12" sm="6" md="6" lg="4" xl="3">
                        <CubePreview cube={cube} />
                      </Col>
                    ),
                )
              ) : (
                <p className="m-2">No cubes with this card found.</p>
              )}
            </Row>
          </TabPane>
        </TabContent>
      </Card>
    );
  }
}

CardPage.propTypes = {
  card: PropTypes.shape({
    name: PropTypes.string.isRequired,
    elo: PropTypes.number.isRequired,
    image_normal: PropTypes.string.isRequired,
    scryfall_uri: PropTypes.string.isRequired,
    tcgplayer_id: PropTypes.string.isRequired,
  }).isRequired,
  data: PropTypes.shape({
    vintage: PropTypes.bool.isRequired,
    legacy: PropTypes.bool.isRequired,
    modern: PropTypes.bool.isRequired,
    standard: PropTypes.bool.isRequired,
    pauper: PropTypes.bool.isRequired,
    size180: PropTypes.number.isRequired,
    size360: PropTypes.number.isRequired,
    size450: PropTypes.number.isRequired,
    size540: PropTypes.number.isRequired,
    size720: PropTypes.number.isRequired,
    total: PropTypes.arrayOf(PropTypes.number).isRequired,
  }).isRequired,
  prices: PropTypes.objectOf(PropTypes.number).isRequired,
  related: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }),
  ).isRequired,
  cubes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

const data = JSON.parse(document.getElementById('data').value);
const card = JSON.parse(document.getElementById('card').value);
const prices = JSON.parse(document.getElementById('prices').value);
const cubes = JSON.parse(document.getElementById('cubes').value);
const related = JSON.parse(document.getElementById('related').value);
const wrapper = document.getElementById('react-root');
const element = <CardPage data={data} card={card} prices={prices} related={related} cubes={cubes} />;
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
