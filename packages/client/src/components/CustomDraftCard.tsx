import React, { useContext, useMemo, useState } from 'react';

import { DraftFormat } from '@utils/datatypes/Draft';
import DOMPurify from 'dompurify';

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

// Formats saved before markdown descriptions carry a raw `html` description written by the cube
// owner. It is sanitized when saved, and again here because it renders on public pages.
const LEGACY_HTML_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'a', 'ul', 'ol', 'li', 'h5', 'h6', 'div'],
  ALLOWED_ATTR: ['href'],
};

const sanitizeLegacyFormatHtml = (html: string | undefined): string =>
  html && DOMPurify.isSupported ? DOMPurify.sanitize(html, LEGACY_HTML_CONFIG) : '';

const CustomDraftCard: React.FC<CustomDraftCardProps> = ({ format, defaultFormat, formatIndex }) => {
  const { cube } = useContext(CubeContext);
  const [seats, setSeats] = useState((format?.defaultSeats ?? cube.defaultDraftSeats ?? 8).toString());
  const formRef = React.createRef<HTMLFormElement>();
  const legacyHtml = useMemo(
    () => (format.markdown ? '' : sanitizeLegacyFormatHtml(format.html)),
    [format.markdown, format.html],
  );

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
            <div className="description-area" dangerouslySetInnerHTML={{ __html: legacyHtml }} />
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
