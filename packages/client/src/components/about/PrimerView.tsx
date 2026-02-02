import React from 'react';

import { Card, CardBody } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import { SafeMarkdown } from 'components/Markdown';

interface PrimerViewProps {
  description: string | null;
  tags?: string[];
}

const PrimerView: React.FC<PrimerViewProps> = ({ description, tags }) => {
  return (
    <Container lg disableCenter className="flex justify-start">
      <Flexbox direction="col" gap="2" className="mb-2 w-full">
        {/* Tags */}
        {tags && tags.length > 0 && (
          <Flexbox direction="row" gap="2" wrap="wrap">
            {tags.map((tag, index) => (
              <a
                key={index}
                href={`/search?q=tag:"${encodeURIComponent(tag)}"`}
                className="px-3 py-1 bg-tag-badge-bg text-tag-badge-text text-sm rounded-full hover:bg-tag-badge-bg/80 transition-colors font-medium"
              >
                {tag}
              </a>
            ))}
          </Flexbox>
        )}
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
