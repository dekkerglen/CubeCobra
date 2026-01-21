import React from 'react';

import classNames from 'classnames';

import { Col, Row } from '../base/Layout';
import Text from '../base/Text';

interface LegalityBadgeProps {
  legality: string;
  status: 'legal' | 'not_legal' | 'banned' | 'restricted';
}

const statusMap = {
  legal: 'Legal',
  not_legal: 'Not Legal',
  banned: 'Banned',
  restricted: 'Restricted',
};

const LegalityBadge: React.FC<LegalityBadgeProps> = ({ legality, status }) => {
  return (
    <Row className="my-2">
      <Col xs={6}>
        <div
          className={classNames('px-2 py-1 rounded centered text-button-text w-full', {
            'bg-button-primary': status === 'legal',
            'bg-button-secondary': status === 'not_legal',
            'bg-button-danger': status === 'banned',
            'bg-button-accent': status === 'restricted',
          })}
        >
          <Text sm semibold>
            {statusMap[status]}
          </Text>
        </div>
      </Col>
      <Col xs={6}>
        <span>{legality}</span>
      </Col>
    </Row>
  );
};

export default LegalityBadge;
