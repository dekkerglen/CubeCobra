import React, { useState } from 'react';

import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';

import AdminTabData from 'components/admin/AdminTabData';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import { PatronTierBadge } from 'components/user/PatronBadge';

interface AdminPatronRow {
  owner: string;
  username: string | null;
  email: string;
  level: number;
  status: string;
}

interface PatronsProps {
  patrons: AdminPatronRow[];
  lastKey: any;
}

const TIER_LEVELS = [PatronLevels['Cobra Hatchling'], PatronLevels['Coiling Oracle'], PatronLevels['Lotus Cobra']];

const renderPatron = (patron: AdminPatronRow) => (
  <Row className="w-full items-center py-2">
    <Col xs={4}>
      {patron.username ? (
        <Link href={`/user/view/${patron.owner}`}>{patron.username}</Link>
      ) : (
        <Text sm className="text-text-secondary">
          (unknown user)
        </Text>
      )}
    </Col>
    <Col xs={4}>
      <Text sm className="text-text-secondary">
        {patron.email}
      </Text>
    </Col>
    <Col xs={2}>
      {TIER_LEVELS.includes(patron.level) ? (
        <PatronTierBadge level={patron.level} />
      ) : (
        <Text sm>{PatronLevels[patron.level] ?? '—'}</Text>
      )}
    </Col>
    <Col xs={2}>
      <Text sm semibold={patron.status === PatronStatuses.ACTIVE}>
        {patron.status === PatronStatuses.ACTIVE ? 'Active' : 'Inactive'}
      </Text>
    </Col>
  </Row>
);

const Patrons: React.FC<PatronsProps> = ({ patrons, lastKey }) => {
  const [items, setItems] = useState<AdminPatronRow[]>(patrons);
  const [currentLastKey, setLastKey] = useState(lastKey);

  return (
    <Card>
      <CardHeader>
        <Text semibold xl>
          Patrons
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Row className="w-full">
            <Col xs={4}>
              <Text sm semibold>
                User
              </Text>
            </Col>
            <Col xs={4}>
              <Text sm semibold>
                Email
              </Text>
            </Col>
            <Col xs={2}>
              <Text sm semibold>
                Tier
              </Text>
            </Col>
            <Col xs={2}>
              <Text sm semibold>
                Status
              </Text>
            </Col>
          </Row>
          <IndefinitePaginatedList
            items={items}
            setItems={setItems}
            lastKey={currentLastKey}
            setLastKey={setLastKey}
            pageSize={48}
            header="All Patrons"
            fetchMoreRoute="/admin/patrons/getmore"
            itemsKey="patrons"
            renderItem={renderPatron}
            noneMessage="No patrons found."
            xs={12}
          />
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const PatronsTab: React.FC = () => (
  <AdminTabData<PatronsProps> url="/admin/patrons/data">
    {({ patrons, lastKey }) => <Patrons patrons={patrons} lastKey={lastKey} />}
  </AdminTabData>
);

export default PatronsTab;
