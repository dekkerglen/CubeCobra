import React, { useContext } from 'react';

import { CardBody } from 'components/base/Card';
import FormatttedDate from 'components/base/FormatttedDate';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import Markdown from 'components/Markdown';
import EditPlayerListModal from 'components/modals/EditPlayerListModal';
import EditRecordOverviewModal from 'components/modals/EditRecordOverviewModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import Record from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import RecordPlayer from './RecordPlayer';

const EditPlayerListLink = withModal(Link, EditPlayerListModal);
const EditRecordOverviewLink = withModal(Link, EditRecordOverviewModal);

interface RecordOverviewProps {
  record: Record;
  players: User[];
}

const RecordOverview: React.FC<RecordOverviewProps> = ({ record, players }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);

  const isOwner = user && cube && user.id === cube.owner.id;

  return (
    <CardBody>
      <Row xs={2}>
        <Col xs={2} md={1}>
          <Flexbox direction="col" gap="1">
            <Text lg semibold>
              {record.name}
            </Text>
            <Text md className="text-muted">
              <FormatttedDate date={record.date} />
            </Text>
            <Markdown markdown={record.description} />
            {isOwner && (
              <EditRecordOverviewLink
                modalprops={{
                  record,
                }}
              >
                <Text sm className="text-muted">
                  {'Edit Overview'}
                </Text>
              </EditRecordOverviewLink>
            )}
          </Flexbox>
        </Col>
        <Col xs={2} md={1}>
          <Flexbox direction="col" gap="2">
            <Text lg semibold>
              {'Players'}
            </Text>
            {isOwner && (
              <EditPlayerListLink
                modalprops={{
                  record,
                }}
              >
                {'Edit Player List'}
              </EditPlayerListLink>
            )}
            {record.players.map((player, index) => (
              <Flexbox key={index} direction="row" gap="3" alignItems="center">
                <Text lg semibold>{`${index + 1}. `}</Text>
                <RecordPlayer
                  key={index}
                  name={player.name}
                  userId={player.userId}
                  user={players.find((u) => u.id === player.userId)}
                />
              </Flexbox>
            ))}
          </Flexbox>
        </Col>
      </Row>
    </CardBody>
  );
};

export default RecordOverview;
