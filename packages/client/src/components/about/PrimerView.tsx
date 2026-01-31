import React from 'react';

import { Card, CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import BlogNavbar from 'components/cube/BlogNavbar';
import { SafeMarkdown } from 'components/Markdown';

interface PrimerViewProps {
  description: string | null;
}

const PrimerView: React.FC<PrimerViewProps> = ({ description }) => {
  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <BlogNavbar />
      {description && (
        <Card>
          <CardBody>
            <SafeMarkdown markdown={description} />
          </CardBody>
        </Card>
      )}
    </Flexbox>
  );
};

export default PrimerView;
