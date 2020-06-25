import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { Card, CardHeader, Row, Col, CardBody, Table } from 'reactstrap';

import CardImage from 'components/CardImage';
import CardGrid from 'components/CardGrid';
import ImageFallback from 'components/ImageFallback';
import ButtonLink from 'components/ButtonLink';
import CountTableRow from 'components/CountTableRow';

import { getTCGLink } from 'utils/Affiliate';

const CardPage = ({ card, data, related }) => {
  const cardList = related.map((item) => ({ details: item }));

  let prices = {};

  for (const price of data.current.prices) {
    if (price.version === card._id) {
      prices = price;
    }
  }

  return (
    <Card className="mt-2">
      <CardHeader>
        <h4>
          {card.name}
          <div className="float-right">
            <ButtonLink className="mx-2" color="success" href={card.scryfall_uri}>
              <span className="d-none d-sm-inline">View on Scryfall</span>
              <span className="d-sm-none">Scryfall</span>
            </ButtonLink>
            <ButtonLink className="mx-2" color="success" href={`/search/card:"${card.name}"/0`}>
              Cubes With This Card
            </ButtonLink>
            <ButtonLink className="mx-2" color="success" href={getTCGLink({ details: card })}>
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
              {card.prices.usd && <div className="card-price">USD: {card.prices.usd.toFixed(2)}</div>}
              {card.prices.usd_foil && <div className="card-price">USD Foil: {card.prices.usd_foil.toFixed(2)}</div>}
              {card.prices.eur && <div className="card-price">EUR: {card.prices.eur.toFixed(2)}</div>}
              {card.prices.tix && <div className="card-price">TIX: {card.prices.tix.toFixed(2)}</div>}
              {card.elo && <div className="card-price">Elo: {card.elo}</div>}
            </div>
          </Col>
          <Col className="breakdown" xs="12" sm="8">
            <p>
              Played in {Math.round(data.current.total[1] * 1000.0) / 10}%
              <span className="percent">{data.current.total[0]}</span> Cubes total.
            </p>
            <Row>
              <Col xs="12" sm="6" md="6" lg="6">
                <h5>By Legality:</h5>
                <Table bordered>
                  <tbody>
                    <CountTableRow label="Vintage" value={data.current.vintage} />
                    <CountTableRow label="Legacy" value={data.current.legacy} />
                    <CountTableRow label="Modern" value={data.current.modern} />
                    <CountTableRow label="Standard" value={data.current.standard} />
                    <CountTableRow label="Pauper" value={data.current.pauper} />
                  </tbody>
                </Table>
              </Col>
              <Col xs="12" sm="6" md="6" lg="6">
                <h5>By Size:</h5>
                <Table bordered>
                  <tbody>
                    <CountTableRow label="1-180" value={data.current.size180} />
                    <CountTableRow label="181-360" value={data.current.size360} />
                    <CountTableRow label="361-450" value={data.current.size450} />
                    <CountTableRow label="451-540" value={data.current.size540} />
                    <CountTableRow label="541+" value={data.current.size720} />
                  </tbody>
                </Table>
              </Col>
            </Row>
          </Col>
        </Row>
      </CardBody>
      <CardBody>
        <h4>Often Drafted With:</h4>
        <CardGrid
          cardList={cardList}
          Tag={CardImage}
          colProps={{ xs: 6, sm: 4, className: 'col-md-1-5 col-lg-1-5 col-xl-1-5' }}
          cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
          linkDetails
        />
      </CardBody>
    </Card>
  );
};

CardPage.propTypes = {
  card: PropTypes.shape({
    name: PropTypes.string.isRequired,
    elo: PropTypes.number.isRequired,
    image_normal: PropTypes.string.isRequired,
    scryfall_uri: PropTypes.string.isRequired,
    tcgplayer_id: PropTypes.string.isRequired,
    prices: PropTypes.shape({
      usd: PropTypes.number,
      usd_foil: PropTypes.number,
      eur: PropTypes.number,
      tix: PropTypes.number,
    }).isRequired,
  }).isRequired,
  data: PropTypes.shape({
    current: PropTypes.shape({
      prices: PropTypes.arrayOf(
        PropTypes.shape({
          price: PropTypes.number,
          price_foil: PropTypes.number,
        }),
      ).isRequired,
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
    }),
  }).isRequired,
  related: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const wrapper = document.getElementById('react-root');
const element = <CardPage {...window.reactProps} />;
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
