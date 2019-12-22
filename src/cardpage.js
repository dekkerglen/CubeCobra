import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import {
  Card,
  CardHeader,
  CardFooter,
  Row,
  Col,
  CardBody,
  CardText,
  Table,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
} from 'reactstrap';

import ImageFallback from './components/ImageFallback';
import ButtonLink from './components/ButtonLink';
import CountTableRow from './components/CountTableRow';
import CubePreview from './components/CubePreview';

import Affiliate from './util/Affiliate';

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
    return (
      <Card>
        <CardHeader>
          <h4>{card.name}</h4>
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
                {!prices[card.tcgplayer_id] ? (
                  ''
                ) : (
                  <div className="card-price">TCGPlayer Market: {prices[card.tcgplayer_id].toFixed(2)}</div>
                )}
                {!prices[card.tcgplayer_id + '_foil'] ? (
                  ''
                ) : (
                  <div className="card-price">
                    Foil TCGPlayer Market: {prices[card.tcgplayer_id + '_foil'].toFixed(2)}
                  </div>
                )}
              </div>
            </Col>
            <Col className="breakdown" xs="12" sm="8">
              <p>
                {'Played in '}
                {Math.round(data.total[1] * 1000.0) / 10}%<span className="percent">{data.total[0]}</span>
                {' Cubes total.'}
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
              className={this.state.selectedTab == '1' ? 'active mx-2' : 'mx-2 clickable'}
              onClick={() => {
                this.changeTab('1');
              }}
            >
              Often Drafted With
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={this.state.selectedTab == '2' ? 'active mx-2' : 'mx-2 clickable'}
              onClick={() => {
                this.changeTab('2');
              }}
            >
              Cubes With This Card
            </NavLink>
          </NavItem>
        </Nav>
        <TabContent activeTab={this.state.selectedTab}>
          <TabPane tabId="1">
            <CardBody>
              <Row>
                {related.map((item) => (
                  <a key={item.name} href={'/tool/card/' + item.name}>
                    <img width="150" height="210" src={item.image_normal} />
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
        <CardFooter>
          <ButtonLink className="mx-2" color="success" href={card.scryfall_uri}>
            <span className="d-none d-sm-inline">View on Scryfall</span>
            <span className="d-sm-none">Scryfall</span>
          </ButtonLink>
          <ButtonLink className="mx-2" color="secondary" href={Affiliate.getTCGLink({ details: card })}>
            Buy
          </ButtonLink>
        </CardFooter>
      </Card>
    );
  }
}

const data = JSON.parse(document.getElementById('data').value);
const card = JSON.parse(document.getElementById('card').value);
const prices = JSON.parse(document.getElementById('prices').value);
const cubes = JSON.parse(document.getElementById('cubes').value);
const related = JSON.parse(document.getElementById('related').value);
const wrapper = document.getElementById('react-root');
const element = <CardPage data={data} card={card} prices={prices} related={related} cubes={cubes} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
