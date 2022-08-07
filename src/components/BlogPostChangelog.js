import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'reactstrap';

import { PlusCircleIcon, NoEntryIcon, ArrowSwitchIcon, ToolsIcon, ArrowRightIcon } from '@primer/octicons-react';
import withAutocard from 'components/WithAutocard';
import CardPropType from 'proptypes/CardPropType';

const TextAutocard = withAutocard('a');

const Add = ({ card }) => {
  return (
    <li>
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {card.details.name}
      </TextAutocard>
    </li>
  );
};

Add.propTypes = {
  card: CardPropType.isRequired,
};

const Remove = ({ oldCard }) => (
  <li>
    <span className="mx-1" style={{ color: 'red' }}>
      <NoEntryIcon />
    </span>
    <TextAutocard href={`/tool/card/${oldCard.cardID}`} card={oldCard}>
      {oldCard.details.name}
    </TextAutocard>
  </li>
);

Remove.propTypes = {
  oldCard: CardPropType.isRequired,
};

const Edit = ({ card }) => (
  <li>
    <span className="mx-1" style={{ color: 'orange' }}>
      <ToolsIcon />
    </span>
    <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
      {card.details.name}
    </TextAutocard>
  </li>
);

Edit.propTypes = {
  card: CardPropType.isRequired,
};

const Swap = ({ oldCard, card }) => {
  return (
    <li>
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      <TextAutocard href={`/tool/card/${oldCard.cardID}`} card={oldCard}>
        {oldCard.details.name}
      </TextAutocard>
      <ArrowRightIcon className="mx-1" />
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {card.details.name}
      </TextAutocard>
    </li>
  );
};

Swap.propTypes = {
  oldCard: CardPropType.isRequired,
  card: CardPropType.isRequired,
};

const BlogPostChangelog = ({ changelog }) => {
  return (
    <div>
      {Object.entries(changelog).map(([board, { adds, removes, swaps, edits }]) => (
        <div key={board} className="mb-2">
          <h6>
            <Row>
              <Col>{board} Changelist</Col>
              <Col className="col-auto">
                <div className="text-secondary">
                  +{(adds || []).length}, -{(removes || []).length}
                </div>
              </Col>
            </Row>
          </h6>
          <ul className="changelist">
            {adds && adds.map((card) => <Add key={card} card={card} />)}
            {removes && removes.map((remove) => <Remove key={remove.oldCard.cardID} oldCard={remove.oldCard} />)}
            {swaps &&
              swaps.map((swap) => (
                <Swap key={`${swap.oldCard.cardID}->${swap.card.cardID}`} oldCard={swap.oldCard} card={swap.card} />
              ))}
            {edits && edits.map((edit) => <Edit key={edit.oldCard.cardID} card={edit.oldCard} />)}
          </ul>
        </div>
      ))}
    </div>
  );
};

BlogPostChangelog.propTypes = {
  changelog: PropTypes.shape({}).isRequired,
};

export default BlogPostChangelog;
