import React from 'react';

import FormatttedDate from 'components/base/FormatttedDate';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { Tile } from 'components/base/Tile';
import Record from 'datatypes/Record';

interface RecordPreviewProps {
  record: Record;
}

const RecordPreview: React.FC<RecordPreviewProps> = ({ record }) => {
  return (
    <Tile href={`/cube/records/${record.id}`}>
      <Flexbox direction="col" className="p-1 flex-grow">
        <Text semibold md className="truncate">
          {record.name}
        </Text>
        <Flexbox direction="row" justify="between">
          <Text sm className="text-text-secondary">
            <FormatttedDate date={record.date} />
          </Text>
        </Flexbox>
        <div className="flex-grow">
          <Text area sm>
            {record.description}
          </Text>
        </div>
      </Flexbox>
    </Tile>
  );
};

export default RecordPreview;
