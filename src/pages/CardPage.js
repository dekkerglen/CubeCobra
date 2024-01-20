import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CardPricePropType from 'proptypes/CardPricePropType';
import CardPropType from 'proptypes/CardPropType';
import HistoryPropType from 'proptypes/HistoryPropType';

import {
  Card,
  CardHeader,
  Row,
  Col,
  CardBody,
  Nav,
  TabContent,
  TabPane,
  InputGroup,
  InputGroupText,
  Table,
  Badge,
  Button,
  Input,
} from 'reactstrap';

import CardImage from 'components/CardImage';
import CardGrid from 'components/CardGrid';
import ImageFallback from 'components/ImageFallback';
import PagedList from 'components/PagedList';
import withAutocard from 'components/WithAutocard';
import Markdown from 'components/Markdown';
import ButtonLink from 'components/ButtonLink';
import CountTableRow from 'components/CountTableRow';
import Tooltip from 'components/Tooltip';
import TextBadge from 'components/TextBadge';
import AddToCubeModal from 'components/AddToCubeModal';
import CommentsSection from 'components/CommentsSection';
import withModal from 'components/WithModal';
import DynamicFlash from 'components/DynamicFlash';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import PlayRateGraph from 'components/PlayRateGraph';
import Tab from 'components/Tab';
import EloGraph from 'components/EloGraph';

import {
  cardFoilPrice,
  cardPriceEur,
  cardTix,
  cardElo,
  cardPopularity,
  cardCubeCount,
  cardEtchedPrice,
  cardNormalPrice,
} from 'utils/Card';
import {
  getTCGLink,
  getCardMarketLink,
  getCardHoarderLink,
  getCardKingdomLink,
  nameToDashedUrlComponent,
} from 'utils/Affiliate';
import { ArrowSwitchIcon, CheckIcon, ClippyIcon } from '@primer/octicons-react';

const AutocardA = withAutocard('a');
const AddModal = withModal(Button, AddToCubeModal);

const convertLegality = {
  legal: ['success', 'Legal'],
  not_legal: ['secondary', 'Not Legal'],
  banned: ['danger', 'Banned'],
  restricted: ['warning', 'Restricted'],
};

function LegalityBadge({ legality, status }) {
  return (
    <h6>
      <Badge className="legality-badge" color={convertLegality[status][0]}>
        {convertLegality[status][1]}
      </Badge>{' '}
      {legality}
    </h6>
  );
}

LegalityBadge.propTypes = {
  legality: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
};

function CardIdBadge({ id }) {
  const [copied, setCopied] = useState(false);

  const onCopyClick = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
  };

  return (
    <InputGroup className="flex-nowrap mb-3" size="sm">
      <InputGroupText>Card ID</InputGroupText>
      <Input className="bg-white" value={id} disabled />
      <Button className="btn-sm input-group-button" onClick={onCopyClick} style={{ width: 'auto' }}>
        {copied ? <CheckIcon size={16} /> : <ClippyIcon size={16} />}
      </Button>
    </InputGroup>
  );
}

CardIdBadge.propTypes = {
  id: PropTypes.string.isRequired,
};

function CardPage({ card, history, versions, draftedWith, cubedWith, synergistic, loginCallback }) {
  const [selectedTab, setSelectedTab] = useQueryParam('tab', '0');
  const [correlatedTab, setCorrelatedTab] = useQueryParam('correlatedTab', '0');
  const [imageUsed, setImageUsed] = useState(card.image_normal);

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

  const filteredVersions = sortedVersions.filter((version) => version.scryfall_id !== card.scryfall_id);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="mt-2">
        <CardHeader>
          <h4>{card.name}</h4>
          <h6>{`${card.set_name} [${card.set.toUpperCase()}-${card.collector_number}]`}</h6>
        </CardHeader>
        <Row className="mt-2 g-0">
          <Col className="ps-2 pb-2" xs="12" sm="3">
            <ImageFallback className="w-100" src={imageUsed} fallbackSrc="/content/default_card.png" alt={card.name} />
            {card.image_flip && (
              <Button
                className="mt-1"
                color="accent"
                outline
                block
                onClick={() => {
                  if (imageUsed === card.image_normal) {
                    setImageUsed(card.image_flip);
                  } else {
                    setImageUsed(card.image_normal);
                  }
                }}
              >
                <ArrowSwitchIcon size={16} /> Transform
              </Button>
            )}
            <CardBody className="breakdown p-1">
              <p>
                Played in {cardPopularity({ details: card })}%
                <span className="percent">{cardCubeCount({ details: card })}</span> cubes total.
              </p>
              <AddModal color="accent" block outline className="mb-1 me-2" modalProps={{ card, hideAnalytics: true }}>
                Add to Cube...
              </AddModal>
              <CardIdBadge id={card.scryfall_id} />
              {card.prices && Number.isFinite(cardNormalPrice({ details: card })) && (
                <TextBadge name="Price" className="mt-1" fill>
                  <Tooltip text="TCGPlayer Market Price">${cardNormalPrice({ details: card }).toFixed(2)}</Tooltip>
                </TextBadge>
              )}
              {card.prices && Number.isFinite(cardFoilPrice({ details: card })) && (
                <TextBadge name="Foil" className="mt-1" fill>
                  <Tooltip text="TCGPlayer Market Price">${cardFoilPrice({ details: card }).toFixed(2)}</Tooltip>
                </TextBadge>
              )}
              {card.prices && Number.isFinite(cardEtchedPrice({ details: card })) && (
                <TextBadge name="Etched" className="mt-1" fill>
                  <Tooltip text="TCGPlayer Market Price">${cardEtchedPrice({ details: card }).toFixed(2)}</Tooltip>
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
          <Col className="breakdown" xs="12" sm="9">
            <Nav tabs>
              <Tab tab={selectedTab} setTab={setSelectedTab} index="0">
                Card
              </Tab>
              <Tab tab={selectedTab} setTab={setSelectedTab} index="1">
                Elo
              </Tab>
              <Tab tab={selectedTab} setTab={setSelectedTab} index="3">
                Play Rate
              </Tab>
              <Tab tab={selectedTab} setTab={setSelectedTab} index="4">
                Links
              </Tab>
              <Tab tab={selectedTab} setTab={setSelectedTab} index="5">
                Discussion
              </Tab>
            </Nav>
            <TabContent activeTab={selectedTab}>
              <TabPane tabId="0">
                <CardBody>
                  <Row>
                    <Col xs="6">
                      <div className="text-start">
                        <b>{card.name}</b>
                      </div>
                    </Col>
                    <Col xs="6">
                      <div className="text-end">
                        {card.parsed_cost
                          .slice(0)
                          .reverse()
                          .map((symbol) => (
                            <img
                              key={`mana-symbol-${symbol}`}
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
                  <div className="my-0">
                    {card.oracle_text.split('\n').map((text) => (
                      <Markdown markdown={text} key={text} />
                    ))}
                  </div>
                  <Row>
                    <Col xs="6">
                      <div className="text-start">
                        <small>
                          <i>{`Illustrated by ${card.artist}`}</i>
                        </small>
                      </div>
                    </Col>
                    <Col xs="6">
                      <div className="text-end">
                        {card.loyalty && <p>{card.loyalty}</p>}
                        {card.power && <p>{`${card.power} / ${card.toughness}`}</p>}
                      </div>
                    </Col>
                  </Row>

                  <hr />
                  <Row>
                    <Col xs="12" sm="6">
                      {['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage'].map((key) => (
                        <LegalityBadge key={key} legality={key} status={card.legalities[key]} />
                      ))}
                    </Col>
                    <Col xs="12" sm="6">
                      {['Brawl', 'Historic', 'Pauper', 'Penny', 'Commander'].map((key) => (
                        <LegalityBadge key={key} legality={key} status={card.legalities[key]} />
                      ))}
                    </Col>
                  </Row>
                </CardBody>
              </TabPane>
              <TabPane tabId="1">
                <CardBody>
                  <EloGraph defaultHistories={history} cardId={card.oracle_id} />
                </CardBody>
              </TabPane>
              <TabPane tabId="3">
                <CardBody>
                  {history.length > 1 ? (
                    <>
                      <PlayRateGraph defaultHistories={history} cardId={card.oracle_id} />
                      <Row className="pt-2">
                        <Col xs="12" sm="6" md="6" lg="6">
                          <h5>By Legality:</h5>
                          <Table bordered>
                            <tbody>
                              <CountTableRow label="Vintage" value={history[history.length - 1].vintage || [0, 0]} />
                              <CountTableRow label="Legacy" value={history[history.length - 1].legacy || [0, 0]} />
                              <CountTableRow label="Modern" value={history[history.length - 1].modern || [0, 0]} />
                              <CountTableRow label="Peasant" value={history[history.length - 1].peasant || [0, 0]} />
                              <CountTableRow label="Pauper" value={history[history.length - 1].pauper || [0, 0]} />
                            </tbody>
                          </Table>
                        </Col>
                        <Col xs="12" sm="6" md="6" lg="6">
                          <h5>By Size:</h5>
                          <Table bordered>
                            <tbody>
                              <CountTableRow label="1-180" value={history[history.length - 1].size180 || [0, 0]} />
                              <CountTableRow label="181-360" value={history[history.length - 1].size360 || [0, 0]} />
                              <CountTableRow label="361-450" value={history[history.length - 1].size450 || [0, 0]} />
                              <CountTableRow label="451-540" value={history[history.length - 1].size540 || [0, 0]} />
                              <CountTableRow label="541+" value={history[history.length - 1].size720 || [0, 0]} />
                            </tbody>
                          </Table>
                        </Col>
                      </Row>
                    </>
                  ) : (
                    <p>No play data available.</p>
                  )}
                </CardBody>
              </TabPane>
              <TabPane tabId="4">
                <CardBody>
                  <Row>
                    <Col className="pb-2" xs="12" sm="6">
                      <ButtonLink outline color="accent" block href={`/search/card:${card.name}`} target="_blank">
                        {`Cubes with ${card.name}`}
                      </ButtonLink>
                    </Col>
                    <Col className="pb-2" xs="12" sm="6">
                      <ButtonLink
                        outline
                        color="accent"
                        block
                        href={`/tool/searchcards?f=name%3A"${card.name}"&p=0&di=printings`}
                        target="_blank"
                      >
                        View all Printings
                      </ButtonLink>
                    </Col>
                    <Col className="pb-2" xs="12" sm="6">
                      <ButtonLink outline color="accent" block href={card.scryfall_uri} target="_blank">
                        View on Scryfall
                      </ButtonLink>
                    </Col>
                    <Col className="pb-2" xs="12" sm="6">
                      <ButtonLink outline color="accent" block href={getTCGLink({ details: card })} target="_blank">
                        View on TCGPlayer
                      </ButtonLink>
                    </Col>
                    <Col className="pb-2" xs="12" sm="6">
                      <ButtonLink
                        outline
                        color="accent"
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
                        color="accent"
                        block
                        href={`https://edhrec.com/cards/${nameToDashedUrlComponent(card.name)}`}
                        target="_blank"
                      >
                        View on EDHRec
                      </ButtonLink>
                    </Col>
                    <Col className="pb-2" xs="12" sm="6">
                      <ButtonLink
                        outline
                        color="accent"
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
              <TabPane tabId="5">
                <div className="border-start border-bottom">
                  <CommentsSection parentType="card" parent={card.oracle_id} collapse={false} />
                </div>
              </TabPane>
            </TabContent>
          </Col>
        </Row>
      </Card>
      <Row>
        <Col xs="12" sm="6">
          <Card className="mt-4">
            <CardHeader>
              <h4>Versions</h4>
            </CardHeader>
            {filteredVersions.length > 0 ? (
              <PagedList
                pageSize={10}
                // eslint-disable-next-line react/no-unstable-nested-components
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
                rows={filteredVersions.slice(0).map((version) => (
                  <tr key={version.scryfall_id}>
                    <td>
                      <AutocardA card={{ details: version }} href={`/tool/card/${version.scryfall_id}`}>
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
            ) : (
              <CardBody>
                <p>No other versions</p>
              </CardBody>
            )}
          </Card>
        </Col>
        <Col xs="12" sm="6">
          <Card className="mt-4">
            <CardHeader>
              <h4>Purchase</h4>
            </CardHeader>
            <CardBody>
              <ButtonLink outline color="accent" block href={getTCGLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-start">
                      <b>TCGPlayer</b>
                    </div>
                  </Col>
                  {card.prices.usd && (
                    <Col xs="6">
                      <div className="text-end">
                        <b>{`$${card.prices.usd.toFixed(2)}`}</b>
                      </div>
                    </Col>
                  )}
                </Row>
              </ButtonLink>
              <ButtonLink outline color="accent" block href={getCardKingdomLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-start">
                      <b>Card Kingdom</b>
                    </div>
                  </Col>
                </Row>
              </ButtonLink>
              <ButtonLink outline color="accent" block href={getCardMarketLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-start">
                      <b>CardMarket</b>
                    </div>
                  </Col>
                  {card.prices.eur && (
                    <Col xs="6">
                      <div className="text-end">
                        <b>{`€${card.prices.eur.toFixed(2)}`}</b>
                      </div>
                    </Col>
                  )}
                </Row>
              </ButtonLink>
              <ButtonLink outline color="accent" block href={getCardHoarderLink({ details: card })} target="_blank">
                <Row>
                  <Col xs="6">
                    <div className="text-start">
                      <b>CardHoarder</b>
                    </div>
                  </Col>
                  {card.prices.tix && (
                    <Col xs="6">
                      <div className="text-end">
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
      {cubedWith.top.length > 0 && (
        <Card className="my-3">
          <CardHeader className="m-0 p-0 pt-2">
            <Nav tabs>
              <Tab tab={correlatedTab} setTab={setCorrelatedTab} index="0">
                <h5>Often Drafted With</h5>
              </Tab>
              <Tab tab={correlatedTab} setTab={setCorrelatedTab} index="1">
                <h5>Often Cubed With</h5>
              </Tab>
              <Tab tab={correlatedTab} setTab={setCorrelatedTab} index="2">
                <h5>Synergistic Cards</h5>
              </Tab>
            </Nav>
          </CardHeader>
          {correlatedTab === '2' && (
            <CardBody>
              <h4>Top cards</h4>
              <CardGrid
                cardList={synergistic.top.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Creatures</h4>
              <CardGrid
                cardList={synergistic.creatures.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Spells</h4>
              <CardGrid
                cardList={synergistic.spells.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Other</h4>
              <CardGrid
                cardList={synergistic.other.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
            </CardBody>
          )}
          {correlatedTab === '0' && (
            <CardBody>
              <h4>Top cards</h4>
              <CardGrid
                cardList={draftedWith.top.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Creatures</h4>
              <CardGrid
                cardList={draftedWith.creatures.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Spells</h4>
              <CardGrid
                cardList={draftedWith.spells.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Other</h4>
              <CardGrid
                cardList={draftedWith.other.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
            </CardBody>
          )}
          {correlatedTab === '1' && (
            <CardBody>
              <h4>Top cards</h4>
              <CardGrid
                cardList={cubedWith.top.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Creatures</h4>
              <CardGrid
                cardList={cubedWith.creatures.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Spells</h4>
              <CardGrid
                cardList={cubedWith.spells.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              <hr />
              <h4>Other</h4>
              <CardGrid
                cardList={cubedWith.other.map((item) => ({ details: item }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
            </CardBody>
          )}
        </Card>
      )}
    </MainLayout>
  );
}

CardPage.propTypes = {
  card: CardPropType.isRequired,
  history: PropTypes.arrayOf(HistoryPropType).isRequired,
  draftedWith: PropTypes.shape({
    top: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    creatures: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    spells: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    other: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
  cubedWith: PropTypes.shape({
    top: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    creatures: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    spells: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    other: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
  synergistic: PropTypes.shape({
    top: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    creatures: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    spells: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
    other: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
  versions: PropTypes.arrayOf(
    PropTypes.shape({
      set_name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
      image_flip: PropTypes.string,
      collector_number: PropTypes.string,
      prices: CardPricePropType.isRequired,
    }).isRequired,
  ).isRequired,
  loginCallback: PropTypes.string,
};

CardPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CardPage);
