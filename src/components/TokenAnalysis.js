import React, { Component } from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';

import Affiliate from '../util/Affiliate';

import withAutocard from './WithAutocard';

const AutocardLink = withAutocard('a');

const TokenAnalysis = ({ tokens }) =>
  <Row>
    {tokens.map(token =>
      <Col key={token[0]._id} xs={6} md={4} lg={3}>
        <Card className="mb-2">
          <a href={Affiliate.getTCGLink({details:token[0]})}>
            <img src={token[0].image_normal} className='card-img-top' />
          </a>
          <CardBody>
            <p className="card-text">
                {token[1].map(card =>
                  <>
                    <AutocardLink
                      key={card.name}
                      href={Affiliate.getTCGLink({details:card})}
                      card={{ details: card }}
                    >
                      {card.name}
                    </AutocardLink>
                    <br />
                  </>
                )}
            </p>
          </CardBody>
        </Card>
      </Col>
    )}
  </Row>;

export default TokenAnalysis;
