import React, { useContext, useMemo, useState } from 'react';

import { DraftFormat } from '@utils/datatypes/Draft';

import CubeContext from '../contexts/CubeContext';
import Button from './base/Button';
import { Card, CardBody, CardFooter, CardHeader } from './base/Card';
import Select from './base/Select';
import Text from './base/Text';
import CSRFForm from './CSRFForm';
import Markdown from './Markdown';

interface CustomDraftCardProps {
  format: DraftFormat;
  defaultFormat: number;
  formatIndex: number;
}

const range = (lo: number, hi: number): number[] => Array.from(Array(hi - lo).keys()).map((n) => n + lo);

const CustomDraftCard: React.FC<CustomDraftCardProps> = ({ format, defaultFormat, formatIndex }) => {
  const { cube } = useContext(CubeContext);
  const [seats, setSeats] = useState(format?.defaultSeats?.toString() || '8');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(
    () => ({
      seats: `${seats}`,
      id: `${formatIndex}`,
    }),
    [formatIndex, seats],
  );

  return (
    <Card>
      <CSRFForm method="POST" key="createDraft" action={`/draft/start/${cube.id}`} formData={formData} ref={formRef}>
        <CardHeader>
          <Text lg semibold>
            {defaultFormat === formatIndex && 'Default Format: '}
            {format.title} (Custom Draft)
          </Text>
        </CardHeader>
        <CardBody>
          {format.markdown ? (
            <div className="mb-3">
              <Markdown markdown={format.markdown} />
            </div>
          ) : (
            <div className="description-area" dangerouslySetInnerHTML={{ __html: format.html ?? '' }} />
          )}
          <Select
            label="Total Seats"
            options={range(2, 17).map((i) => ({ value: `${i}`, label: `${i}` }))}
            value={seats}
            setValue={setSeats}
          />
        </CardBody>
        <CardFooter>
          <Button type="submit" color="primary" block onClick={() => formRef.current?.submit()}>
            Start Draft
          </Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

export default CustomDraftCard;
