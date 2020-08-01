import React, { useState } from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardHeader,
  Row,
  Col,
  CardBody,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  CustomInput,
  Table,
  Badge,
} from 'reactstrap';

import CardImage from 'components/CardImage';
import CardGrid from 'components/CardGrid';
import ImageFallback from 'components/ImageFallback';
import PagedList from 'components/PagedList';
import withAutocard from 'components/WithAutocard';
import MagicMarkdown from 'components/MagicMarkdown';
import ButtonLink from 'components/ButtonLink';
import CountTableRow from 'components/CountTableRow';
import Tooltip from 'components/Tooltip';
import TextBadge from 'components/TextBadge';
import ChartComponent from 'react-chartjs-2';
import similarity from 'compute-cosine-similarity';

import { cardPrice, cardFoilPrice, cardPriceEur, cardTix, cardElo } from 'utils/Card';
import { getTCGLink, getCardMarketLink, getCardHoarderLink, getCardKingdomLink } from 'utils/Affiliate';

const AutocardA = withAutocard('a');

const Graph = ({ data, yFunc, unit, yRange }) => {
  const plot = {
    labels: [unit],
    datasets: [
      {
        lineTension: 0.2,
        fill: false,
        borderColor: '#28A745',
        backgroundColor: '#28A745',
        data: data
          .map((point) => {
            try {
              return { x: new Date(point.date), y: yFunc(point.data) };
            } catch (exc) {
              return {}; // if the yFunc fails this will get filtered out
            }
          })
          .filter((point) => point.y),
      },
    ],
  };

  let options = {};

  if (plot.datasets[0].data.length > 0) {
    options = {
      legend: {
        display: false,
      },
      responsive: true,
      tooltips: {
        mode: 'index',
        intersect: false,
      },
      hover: {
        mode: 'nearest',
        intersect: true,
      },
      scales: {
        xAxes: [
          {
            type: 'time',
            distribution: 'linear',
            time: {
              unit: 'day',
            },
            ticks: {
              min: plot.datasets[0].data[0].x,
            },
          },
        ],
        yAxes: [
          {
            display: true,
            scaleLabel: {
              display: true,
              labelString: unit,
            },
            ticks: yRange ? { min: yRange[0], max: yRange[1] } : {},
          },
        ],
      },
    };
  }

  if (plot.datasets[0].data.length > 0) {
    return <ChartComponent options={options} data={plot} type="line" />;
  }
  return <p>No data to show.</p>;
};

Graph.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  yFunc: PropTypes.func.isRequired,
  unit: PropTypes.string.isRequired,
  yRange: PropTypes.arrayOf(PropTypes.number),
};

Graph.defaultProps = {
  yRange: null,
};

const convertLegality = {
  legal: ['success', 'Legal'],
  not_legal: ['secondary', 'Not Legal'],
  banned: ['danger', 'Banned'],
  restricted: ['warning', 'Restricted'],
};

const LegalityBadge = ({ legality, status }) => {
  return (
    <h6>
      <Badge className="legality-badge" color={convertLegality[status][0]}>
        {convertLegality[status][1]}
      </Badge>{' '}
      {legality}
    </h6>
  );
};

LegalityBadge.propTypes = {
  legality: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
};

const Tab = ({ tab, setTab, index, children }) => {
  return (
    <NavItem className="ml-2 clickable">
      <NavLink
        active={tab === index}
        onClick={() => {
          setTab(index);
        }}
      >
        {children}
      </NavLink>
    </NavItem>
  );
};

Tab.propTypes = {
  tab: PropTypes.string.isRequired,
  setTab: PropTypes.func.isRequired,
  index: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const getPriceTypeUnit = {
  price: 'USD',
  price_foil: 'USD',
  eur: 'EUR',
  tix: 'TIX',
};

const CardPage = ({ card, data, versions, related }) => {
  const [selectedTab, setSelectedTab] = useState('0');
  const [priceType, setPriceType] = useState('price');
  const [cubeType, setCubeType] = useState('total');

  const sortedVersions = versions.sort((a, b) => {
    const date1 = new Date(a.released_at);
    const date2 = new Date(b.released_at);

    if (date1 > date2) {
      return -1;
    }
    if (date2 > date1) {
      return 1;
    }
    return 0;
  });

  return (
    <>
      <Card className="mt-2">
        <CardHeader>
          <h4>{card.name}</h4>
          <h6>{`${card.set_name} [${card.set.toUpperCase()}-${card.collector_number}]`}</h6>
        </CardHeader>
        <CardBody className="pb-0">
          <Row>
            <Col className="px-0" xs="12" sm="3">
              <ImageFallback
                className="w-100"
                src={card.image_normal}
                fallbackSrc="/content/default_card.png"
                alt={card.name}
              />
              <CardBody className="breakdown p-1">
                <p>
                  Played in {Math.round(data.current.total[1] * 1000.0) / 10}%
                  <span className="percent">{data.current.total[0]}</span> Cubes total.
                </p>
                {card.prices && Number.isFinite(cardPrice({ details: card })) && (
                  <TextBadge name="Price" className="mt-1" fill>
                    <Tooltip text="TCGPlayer Market Price">${cardPrice({ details: card }).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.prices && Number.isFinite(cardFoilPrice({ details: card })) && (
                  <TextBadge name="Foil" className="mt-1" fill>
                    <Tooltip text="TCGPlayer Market Price">${cardFoilPrice({ details: card }).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.prices && Number.isFinite(cardPriceEur({ details: card })) && (
                  <TextBadge name="EUR" className="mt-1" fill>
                    <Tooltip text="Cardmarket Price">€{cardPriceEur({ details: card }).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {card.prices && Number.isFinite(cardTix({ details: card })) && (
                  <TextBadge name="TIX" className="mt-1" fill>
                    <Tooltip text="MTGO TIX">{cardTix({ details: card }).toFixed(2)}</Tooltip>
                  </TextBadge>
                )}
                {Number.isFinite(cardElo({ details: card })) && (
                  <TextBadge name="Elo" className="mt-1" fill>
                    {cardElo({ details: card }).toFixed(0)}
                  </TextBadge>
                )}
              </CardBody>
            </Col>
            <Col className="breakdown px-0" xs="12" sm="9">
              <Nav tabs>
                <Tab tab={selectedTab} setTab={setSelectedTab} index="0">
                  Card
                </Tab>
                <Tab tab={selectedTab} setTab={setSelectedTab} index="1">
                  Elo
                </Tab>
                <Tab tab={selectedTab} setTab={setSelectedTab} index="2">
                  Price
                </Tab>
                <Tab tab={selectedTab} setTab={setSelectedTab} index="3">
                  Play Rate
                </Tab>
                <Tab tab={selectedTab} setTab={setSelectedTab} index="4">
                  Links
                </Tab>
              </Nav>
              <CardBody>
                <TabContent activeTab={selectedTab}>
                  <TabPane tabId="0">
                    <CardBody>
                      <Row>
                        <Col xs="6">
                          <div className="text-left">
                            <b>{card.name}</b>
                          </div>
                        </Col>
                        <Col xs="6">
                          <div className="text-right">
                            {card.parsed_cost
                              .slice(0)
                              .reverse()
                              .map((symbol, index) => (
                                <img
                                  key={`mana-symbol-${symbol}-${index}`}
                                  alt={symbol}
                                  className="mana-symbol"
                                  src={`/content/symbols/${symbol}.png`}
                                />
                              ))}
                          </div>
                        </Col>
                      </Row>
                      <hr />
                      <p className="my-0">{card.type}</p>
                      <hr />
                      <p className="my-0">
                        {card.oracle_text.split('\n').map((text, index) => (
                          <p>
                            <MagicMarkdown key={`oracle-text-${index}`} markdown={text} />
                          </p>
                        ))}
                      </p>
                      <Row>
                        <Col xs="6">
                          <div className="text-left">
                            <small>
                              <i>{`Illustrated by ${card.artist}`}</i>
                            </small>
                          </div>
                        </Col>
                        <Col xs="6">
                          <div className="text-right">
                            <>{card.loyalty && <p>{card.loyalty}</p>}</>
                            <>{card.power && <p>{`${card.power} / ${card.toughness}`}</p>}</>
                          </div>
                        </Col>
                      </Row>

                      <hr />
                      <Row>
                        <Col xs="12" sm="6">
                          {['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage'].map((key) => (
                            <LegalityBadge legality={key} status={card.legalities[key]} />
                          ))}
                        </Col>
                        <Col xs="12" sm="6">
                          {['Brawl', 'Historic', 'Pauper', 'Penny', 'Commander'].map((key) => (
                            <LegalityBadge legality={key} status={card.legalities[key]} />
                          ))}
                        </Col>
                      </Row>
                    </CardBody>
                  </TabPane>
                  <TabPane tabId="1">
                    <Graph unit="Elo" data={data.history} yFunc={(point) => point.elo} />
                  </TabPane>
                  <TabPane tabId="2">
                    <InputGroup className="mb-3">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>Price Type: </InputGroupText>
                      </InputGroupAddon>
                      <CustomInput
                        type="select"
                        value={priceType}
                        onChange={(event) => setPriceType(event.target.value)}
                      >
                        <option value="price">USD</option>
                        <option value="price_foil">USD Foil</option>
                        <option value="eur">EUR</option>
                        <option value="tix">TIX</option>
                      </CustomInput>
                    </InputGroup>
                    <Graph
                      unit={getPriceTypeUnit[priceType]}
                      data={data.history}
                      yFunc={(point) => point.prices.filter((item) => item.version === card._id)[0][priceType]}
                    />
                  </TabPane>
                  <TabPane tabId="3">
                    <InputGroup className="mb-3">
                      <InputGroupAddon addonType="prepend">
                        <InputGroupText>Cube Type: </InputGroupText>
                      </InputGroupAddon>
                      <CustomInput type="select" value={cubeType} onChange={(event) => setCubeType(event.target.value)}>
                        <option value="total">All</option>
                        <option value="vintage">Vintage</option>
                        <option value="legacy">Legacy</option>
                        <option value="modern">Modern</option>
                        <option value="standard">Standard</option>
                        <option value="peasant">Peasant</option>
                        <option value="pauper">Pauper</option>
                        <option value="size180">1-180 Cards</option>
                        <option value="size360">181-360 Cards</option>
                        <option value="size450">361-450 Cards</option>
                        <option value="size540">451-540 Cards</option>
                        <option value="size720">541+ Cards</option>
                      </CustomInput>
                    </InputGroup>
                    <Graph
                      unit="Percent of Cubes"
                      data={data.history}
                      yFunc={(point) => 100 * (point[cubeType] || [0, 0])[1]}
                      yRange={[0, 100]}
                    />
                    <Row className="pt-2">
                      <Col xs="12" sm="6" md="6" lg="6">
                        <h5>By Legality:</h5>
                        <Table bordered>
                          <tbody>
                            <CountTableRow label="Vintage" value={data.current.vintage || [0, 0]} />
                            <CountTableRow label="Legacy" value={data.current.legacy || [0, 0]} />
                            <CountTableRow label="Modern" value={data.current.modern || [0, 0]} />
                            <CountTableRow label="Standard" value={data.current.standard || [0, 0]} />
                            <CountTableRow label="Peasant" value={data.current.peasant || [0, 0]} />
                            <CountTableRow label="Pauper" value={data.current.pauper || [0, 0]} />
                          </tbody>
                        </Table>
                      </Col>
                      <Col xs="12" sm="6" md="6" lg="6">
                        <h5>By Size:</h5>
                        <Table bordered>
                          <tbody>
                            <CountTableRow label="1-180" value={data.current.size180 || [0, 0]} />
                            <CountTableRow label="181-360" value={data.current.size360 || [0, 0]} />
                            <CountTableRow label="361-450" value={data.current.size450 || [0, 0]} />
                            <CountTableRow label="451-540" value={data.current.size540 || [0, 0]} />
                            <CountTableRow label="541+" value={data.current.size720 || [0, 0]} />
                          </tbody>
                        </Table>
                      </Col>
                    </Row>
                  </TabPane>
                  <TabPane tabId="4">
                    <CardBody>
                      <Row>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink
                            outline
                            color="success"
                            block
                            href={`/search/card:"${card.name}"/0`}
                            target="_blank"
                          >
                            {`Cubes with ${card.name}`}
                          </ButtonLink>
                        </Col>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink
                            outline
                            color="success"
                            block
                            href={`/tool/searchcards?f=name%3A"${card.name}"&p=0&di=printings`}
                            target="_blank"
                          >
                            View all Printings
                          </ButtonLink>
                        </Col>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink outline color="success" block href={card.scryfall_uri} target="_blank">
                            View on Scryfall
                          </ButtonLink>
                        </Col>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink
                            outline
                            color="success"
                            block
                            href={getTCGLink({ details: card })}
                            target="_blank"
                          >
                            View on TCGPlayer
                          </ButtonLink>
                        </Col>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink
                            outline
                            color="success"
                            block
                            href={getCardKingdomLink({ details: card })}
                            target="_blank"
                          >
                            View on Card Kingdom
                          </ButtonLink>
                        </Col>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink
                            outline
                            color="success"
                            block
                            href={`https://edhrec.com/cards/${card.name}`}
                            target="_blank"
                          >
                            View on EDHRec
                          </ButtonLink>
                        </Col>
                        <Col className="pb-2" xs="12" sm="6">
                          <ButtonLink
                            outline
                            color="success"
                            block
                            href={`http://mtgtop8.com/search?MD_check=1&SB_check=1&cards=${card.name}`}
                            target="_blank"
                          >
                            {`MTG Top 8 Decks with ${card.name}`}
                          </ButtonLink>
                        </Col>
                      </Row>
                    </CardBody>
                  </TabPane>
                </TabContent>
              </CardBody>
            </Col>
          </Row>
        </CardBody>
      </Card>
      <Row>
        <Col xs="12" sm="6">
          <Card className="mt-4">
            <CardHeader>
              <h4>Versions</h4>
            </CardHeader>
            <PagedList
              pageSize={10}
              pageWrap={(element) => (
                <table className="table table-striped mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Version</th>
                      <th scope="col">USD</th>
                      <th scope="col">USD Foil</th>
                      <th scope="col">EUR</th>
                      <th scope="col">TIX</th>
                    </tr>
                  </thead>
                  <tbody>{element}</tbody>
                </table>
              )}
              rows={sortedVersions.slice(0).map((version) => (
                <tr>
                  <td>
                    <AutocardA
                      front={version.image_normal}
                      back={version.image_flip || undefined}
                      href={`/tool/card/${version._id}`}
                    >
                      {`${version.set_name} [${version.set.toUpperCase()}-${version.collector_number}]`}
                    </AutocardA>
                  </td>
                  <td>{version.prices.usd ? `$${version.prices.usd}` : ''}</td>
                  <td>{version.prices.usd_foil ? `$${version.prices.usd_foil}` : ''}</td>
                  <td>{version.prices.eur ? `€${version.prices.eur}` : ''}</td>
                  <td>{version.prices.tix ? `${version.prices.tix}` : ''}</td>
                </tr>
              ))}
            />
          </Card>
        </Col>
        <Col xs="12" sm="6">
          <Card className="mt-4">
            <CardHeader>
              <h4>Purchase</h4>
            </CardHeader>
            <CardBody>
              <ButtonLink outline color="success" block href={getTCGLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-left">
                      <b>TCGPlayer</b>
                    </div>
                  </Col>
                  {card.prices.usd && (
                    <Col xs="6">
                      <div className="text-right">
                        <b>{`$${card.prices.usd.toFixed(2)}`}</b>
                      </div>
                    </Col>
                  )}
                </Row>
              </ButtonLink>
              <ButtonLink outline color="success" block href={getCardKingdomLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-left">
                      <b>Card Kingdom</b>
                    </div>
                  </Col>
                </Row>
              </ButtonLink>
              <ButtonLink outline color="success" block href={getCardMarketLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-left">
                      <b>CardMarket</b>
                    </div>
                  </Col>
                  {card.prices.eur && (
                    <Col xs="6">
                      <div className="text-right">
                        <b>{`€${card.prices.eur.toFixed(2)}`}</b>
                      </div>
                    </Col>
                  )}
                </Row>
              </ButtonLink>
              <ButtonLink outline color="success" block href={getCardHoarderLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-left">
                      <b>CardHoarder</b>
                    </div>
                  </Col>
                  {card.prices.tix && (
                    <Col xs="6">
                      <div className="text-right">
                        <b>{`${card.prices.tix.toFixed(2)} TIX`}</b>
                      </div>
                    </Col>
                  )}
                </Row>
              </ButtonLink>
            </CardBody>
          </Card>
        </Col>
      </Row>
      <Card className="mt-4">
        <CardHeader>
          <h4>Often Drafted With</h4>
        </CardHeader>
        <CardBody>
          <h4>Most Synergistic Cards</h4>
          <CardGrid
            cardList={related.synergistic.map((card) => ({ details: card }))}
            Tag={CardImage}
            colProps={{ xs: 4, sm: 3, md: 2 }}
            cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
            linkDetails
          />
          <hr />
          <h4>Top Cards</h4>
          <CardGrid
            cardList={related.top.map((card) => ({ details: card }))}
            Tag={CardImage}
            colProps={{ xs: 4, sm: 3, md: 2 }}
            cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
            linkDetails
          />
          <hr />
          <h4>Creatures</h4>
          <CardGrid
            cardList={related.creatures.map((card) => ({ details: card }))}
            Tag={CardImage}
            colProps={{ xs: 4, sm: 3, md: 2 }}
            cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
            linkDetails
          />
          <hr />
          <h4>Spells</h4>
          <CardGrid
            cardList={related.spells.map((card) => ({ details: card }))}
            Tag={CardImage}
            colProps={{ xs: 4, sm: 3, md: 2 }}
            cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
            linkDetails
          />
          <hr />
          <h4>Other</h4>
          <CardGrid
            cardList={related.other.map((card) => ({ details: card }))}
            Tag={CardImage}
            colProps={{ xs: 4, sm: 3, md: 2 }}
            cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
            linkDetails
          />
        </CardBody>
      </Card>
    </>
  );
};

CardPage.propTypes = {
  card: PropTypes.shape({
    name: PropTypes.string.isRequired,
    elo: PropTypes.number.isRequired,
    image_normal: PropTypes.string.isRequired,
    scryfall_uri: PropTypes.string.isRequired,
    tcgplayer_id: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    set: PropTypes.string.isRequired,
    set_name: PropTypes.string.isRequired,
    collector_number: PropTypes.string.isRequired,
    legalities: PropTypes.shape({}).isRequired,
    prices: PropTypes.shape({
      usd: PropTypes.number,
      usd_foil: PropTypes.number,
      eur: PropTypes.number,
      tix: PropTypes.number,
    }).isRequired,
  }).isRequired,
  data: PropTypes.shape({
    history: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    current: PropTypes.shape({
      prices: PropTypes.arrayOf(
        PropTypes.shape({
          usd: PropTypes.number,
          usd_foil: PropTypes.number,
          eur: PropTypes.number,
          tix: PropTypes.number,
        }),
      ).isRequired,
      vintage: PropTypes.bool.isRequired,
      legacy: PropTypes.bool.isRequired,
      modern: PropTypes.bool.isRequired,
      standard: PropTypes.bool.isRequired,
      pauper: PropTypes.bool.isRequired,
      peasant: PropTypes.bool.isRequired,
      size180: PropTypes.number.isRequired,
      size360: PropTypes.number.isRequired,
      size450: PropTypes.number.isRequired,
      size540: PropTypes.number.isRequired,
      size720: PropTypes.number.isRequired,
      total: PropTypes.arrayOf(PropTypes.number).isRequired,
    }),
  }).isRequired,
  related: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }),
  ).isRequired,
  versions: PropTypes.arrayOf(
    PropTypes.shape({
      set_name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
      image_flip: PropTypes.string,
      collector_number: PropTypes.string,
      prices: PropTypes.shape({
        eur: PropTypes.number,
        tix: PropTypes.number,
        usd: PropTypes.number,
        usd_foil: PropTypes.number,
      }).isRequired,
    }).isRequired,
  ).isRequired,
};

export default CardPage;
