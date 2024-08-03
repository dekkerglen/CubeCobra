import React from 'react';
import { Col, Row } from 'reactstrap';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';

import withAutocard from 'components/WithAutocard';
import Card, { BoardType } from 'datatypes/Card';

export interface AddProps {
  card: Card;
}

const TextAutocard = withAutocard('a');

const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const Add: React.FC<AddProps> = ({ card }) => {
  return (
    <li>
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {card.details?.name}
      </TextAutocard>
    </li>
  );
};

export interface RemoveProps {
  oldCard: Card;
}

const Remove: React.FC<RemoveProps> = ({ oldCard }) => (
  <li>
    <span className="mx-1" style={{ color: 'red' }}>
      <NoEntryIcon />
    </span>
    <TextAutocard href={`/tool/card/${oldCard.cardID}`} card={oldCard}>
      {oldCard.details?.name}
    </TextAutocard>
  </li>
);

export interface EditProps {
  card: Card;
}

const Edit: React.FC<EditProps> = ({ card }) => (
  <li>
    <span className="mx-1" style={{ color: 'orange' }}>
      <ToolsIcon />
    </span>
    <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
      {card.details?.name}
    </TextAutocard>
  </li>
);

export interface SwapProps {
  oldCard: Card;
  card: Card;
}

const Swap: React.FC<SwapProps> = ({ oldCard, card }) => {
  return (
    <li>
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      <TextAutocard href={`/tool/card/${oldCard.cardID}`} card={oldCard}>
        {oldCard.details?.name}
      </TextAutocard>
      <ArrowRightIcon className="mx-1" />
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {card.details?.name}
      </TextAutocard>
    </li>
  );
};

export interface BlogPostChangelogProps {
  changelog: {
    [key in BoardType]?: {
      adds?: Card[];
      removes?: { oldCard: Card }[];
      swaps?: { oldCard: Card; card: Card }[];
      edits?: { oldCard: Card }[];
    };
  };
}

const BlogPostChangelog: React.FC<BlogPostChangelogProps> = ({ changelog }) => {
  return (
    <div>
      {Object.entries(changelog).map(([board, { adds, removes, swaps, edits }]) => (
        <div key={board} className="mb-2">
          <h6>
            <Row>
              <Col>{capitalizeFirstLetter(board)} Changelist</Col>
              <Col className="col-auto">
                <div className="text-secondary">
                  +{(adds || []).length + (swaps || []).length}, -{(removes || []).length + (swaps || []).length}
                </div>
              </Col>
            </Row>
          </h6>
          <ul className="changelist">
            {adds && adds.map((card) => <Add key={card.cardID} card={card} />)}
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

export default BlogPostChangelog;
