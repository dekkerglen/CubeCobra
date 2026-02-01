import React from 'react';

import { Card, CardBody } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import { SafeMarkdown } from 'components/Markdown';

interface PrimerViewProps {
  description: string | null;
}

const PrimerView: React.FC<PrimerViewProps> = ({ description }) => {
  return (
    <Container lg disableCenter className="flex justify-start">
      <Flexbox direction="col" gap="2" className="mb-2 w-full">
        {description && (
          <Card>
            <CardBody>
              <SafeMarkdown markdown={description} />
            </CardBody>
          </Card>
        )}
      </Flexbox>
    </Container>
  );
};

export default PrimerView;
