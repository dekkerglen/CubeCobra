import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import Cube from '@utils/datatypes/Cube';
import { P1P1Pack } from '@utils/datatypes/P1P1Pack';

interface DailyP1P1CardProps {
  pack: P1P1Pack;
  cube: Cube;
  date?: number;
}

const DailyP1P1Card: React.FC<DailyP1P1CardProps> = ({ pack, cube, date }) => {
  // Guard against undefined props
  if (!pack || !cube) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center">
          <Text semibold lg>
            Daily Pack 1 Pick 1
            {date
              ? ` - ${new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
              : ''}
          </Text>
          <Link href="/tool/p1p1/archive">Archive</Link>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm className="text-text-secondary">
            From{' '}
            <Link href={`/cube/overview/${cube.id}`} className="font-semibold">
              {cube.name}
            </Link>
            {cube.owner?.username && (
              <>
                {' by '}
                <Link href={`/user/view/${cube.owner.id}`}>{cube.owner.username}</Link>
              </>
            )}
          </Text>

          <Link href={`/tool/p1p1/${pack.id}`}>
            <img
              src={`/cube/p1p1packimage/${pack.id}`}
              alt={`P1P1 pack from ${cube.name}`}
              className="w-full rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </Link>

          <Flexbox direction="row" justify="center" className="mt-2">
            <Button type="link" color="primary" href={`/tool/p1p1/${pack.id}`} block>
              Make Your Pick
            </Button>
          </Flexbox>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default DailyP1P1Card;
