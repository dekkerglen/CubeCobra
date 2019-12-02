import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardHeader,CardFooter, Row, Col, CardBody, CardText, Table } from 'reactstrap';

import ImageFallback from './components/ImageFallback';
import ButtonLink from './components/ButtonLink';
import CountTableRow from './components/CountTableRow';


import Affiliate from './util/Affiliate';

class CardPage extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {card, data, prices} = this.props;
    console.log(data);
    return (
        <Card>
            <CardHeader><h4>{card.name}</h4></CardHeader>
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
                      <div className="card-price">Foil TCGPlayer Market: {prices[card.tcgplayer_id + '_foil'].toFixed(2)}</div>
                    )}
                  </div>
                </Col>
                <Col className='breakdown' xs="12" sm="8">
                  <p>
                    {'Played in '}                     
                    {Math.round(data.total[1] * 1000.0)/10}%
                    <span className="percent">{data.total[0]}</span>
                    {' Cubes total.'}
                  </p>
                  <Row>
                    <Col xs="12" sm="6" md="6" lg="6">
                      <h5>By Legality:</h5>
                      <Table bordered>
                        <tbody>
                          <CountTableRow label="Vintage" value={data.vintage[0]} percent={data.vintage[1]} />
                          <tr>
                            <td>Legacy:</td>
                            <td>
                              {Math.round(data.legacy[1] * 1000.0)/10}%
                              <span className="percent">{data.legacy[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>Modern:</td>
                            <td>
                              {Math.round(data.modern[1] * 1000.0)/10}%                              
                              <span className="percent">{data.modern[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>Standard:</td>
                            <td>
                              {Math.round(data.standard[1] * 1000.0)/10}%
                              <span className="percent">{data.standard[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>Pauper:</td>
                            <td>
                              {Math.round(data.pauper[1] * 1000.0)/10}%
                              <span className="percent">{data.pauper[0]}</span>
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </Col>
                    <Col xs="12" sm="6" md="6" lg="6">
                      <h5>By Size:</h5>
                      <Table bordered>
                        <tbody>
                          <tr>
                            <td>1-180</td>
                            <td>
                              {Math.round(data.size180[1] * 1000.0)/10}%
                              <span className="percent">{data.size180[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>181-360</td>
                            <td>
                              {Math.round(data.size360[1] * 1000.0)/10}%
                              <span className="percent">{data.size360[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>361-450</td>
                            <td>
                              {Math.round(data.size450[1] * 1000.0)/10}%
                              <span className="percent">{data.size450[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>451-540</td>
                            <td>
                              {Math.round(data.size540[1] * 1000.0)/10}%
                              <span className="percent">{data.size540[0]}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>541+</td>
                            <td>
                              {Math.round(data.size720[1] * 1000.0)/10}%
                              <span className="percent">{data.size720[0]}</span>
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </CardBody>
            <CardFooter>
              <ButtonLink className='mx-2' color="success" href={card.scryfall_uri}>
                <span className="d-none d-sm-inline">View on Scryfall</span>
                <span className="d-sm-none">Scryfall</span>
              </ButtonLink>
              <ButtonLink className='mx-2' color="secondary" href={Affiliate.getTCGLink({details:card})}>
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
const related = JSON.parse(document.getElementById('related').value);
const wrapper = document.getElementById('react-root');
const element = <CardPage data={data} card={card} prices={prices} related={related}/>;
wrapper ? ReactDOM.render(element, wrapper) : false;
