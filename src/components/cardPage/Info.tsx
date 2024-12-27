import React from 'react';

import { CardBody } from 'components/base/Card';
import LegalityBadge from 'components/card/CardLegalityBadge';
import Markdown from 'components/Markdown';
import CardType from 'datatypes/CardDetails';
import HistoryType from 'datatypes/History';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import Button from 'components/base/Button';
import { getTCGLink, getCardKingdomLink, nameToDashedUrlComponent } from 'utils/Affiliate';
import { detailsToCard } from 'utils/Card';

interface CardPageProps {
  card: CardType;
  history: HistoryType[];
}

const CardBreakdownInfo: React.FC<CardPageProps> = ({ card }) => {
  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        <Flexbox direction="row" justify="between">
          <Text semibold>{card.name}</Text>
          <Flexbox direction="row">
            {card.parsed_cost
              .slice(0)
              .reverse()
              .map((symbol, index) => (
                <img
                  key={`mana-symbol-${index}`}
                  alt={symbol}
                  className="mana-symbol"
                  src={`/content/symbols/${symbol}.png`}
                />
              ))}
          </Flexbox>
        </Flexbox>
        <hr />
        <Text>{card.type}</Text>
        <hr />
        {card.oracle_text.split('\n').map((text) => (
          <Markdown markdown={text} key={text} />
        ))}
        <Flexbox direction="row" justify="between">
          <Text italic sm>
            {`Illustrated by ${card.artist}`}
          </Text>
          <Text semibold>
            {card.loyalty && card.loyalty}
            {card.power && `${card.power} / ${card.toughness}`}
          </Text>
        </Flexbox>
        <hr />
        <Row>
          <Col xs={6}>
            {['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage'].map((key) => (
              <LegalityBadge key={key} legality={key} status={card.legalities[key]} />
            ))}
          </Col>
          <Col xs={6}>
            {['Brawl', 'Historic', 'Pauper', 'Penny', 'Commander'].map((key) => (
              <LegalityBadge key={key} legality={key} status={card.legalities[key]} />
            ))}
          </Col>
        </Row>
        <hr />
        <Row>
          <Col xs={12} md={6}>
            <Button
              type="link"
              outline
              color="accent"
              block
              href={`/search/?q=${encodeURIComponent(`card:"${card.name}"`)}`}
              target="_blank"
            >
              {`Cubes with ${card.name}`}
            </Button>
          </Col>
          <Col xs={12} md={6}>
            <Button
              type="link"
              outline
              color="accent"
              block
              href={`/tool/searchcards?f=name%3A"${card.name}"&p=0&di=printings`}
              target="_blank"
            >
              View all Printings
            </Button>
          </Col>
          <Col xs={12} md={6}>
            <Button type="link" outline color="accent" block href={card.scryfall_uri} target="_blank">
              View on Scryfall
            </Button>
          </Col>
          <Col xs={12} md={6}>
            <Button type="link" outline color="accent" block href={getTCGLink(detailsToCard(card))} target="_blank">
              View on TCGPlayer
            </Button>
          </Col>
          <Col xs={12} md={6}>
            <Button
              type="link"
              outline
              color="accent"
              block
              href={getCardKingdomLink(detailsToCard(card))}
              target="_blank"
            >
              View on Card Kingdom
            </Button>
          </Col>
          <Col xs={12} md={6}>
            <Button
              type="link"
              outline
              color="accent"
              block
              href={`https://edhrec.com/cards/${nameToDashedUrlComponent(card.name)}`}
              target="_blank"
            >
              View on EDHRec
            </Button>
          </Col>
          <Col xs={12} md={6}>
            <Button
              type="link"
              outline
              color="accent"
              block
              href={`http://mtgtop8.com/search?MD_check=1&SB_check=1&cards=${card.name}`}
              target="_blank"
            >
              {`MTG Top 8 Decks with ${card.name}`}
            </Button>
          </Col>
        </Row>
      </Flexbox>
    </CardBody>
  );
};

export default CardBreakdownInfo;
