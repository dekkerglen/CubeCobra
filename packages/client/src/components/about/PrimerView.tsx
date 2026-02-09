import React, { useContext } from 'react';

import { PencilIcon } from '@primer/octicons-react';

import { Card, CardBody } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Tooltip from 'components/base/Tooltip';
import { SafeMarkdown } from 'components/Markdown';
import CubePrimerModal from 'components/modals/CubePrimerModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

interface PrimerViewProps {
  description: string | null;
  tags?: string[];
}

const CubePrimerModalButton = withModal('a', CubePrimerModal);

const PrimerView: React.FC<PrimerViewProps> = ({ description, tags }) => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);

  const isOwner = user && cube && user.id === cube.owner.id;
  const hasCards = cube?.cardCount > 0;

  return (
    <Container lg disableCenter className="flex justify-start">
      <Flexbox direction="col" gap="2" className="mb-2 w-full">
        {/* Edit Primer Button */}
        {isOwner && (
          <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
            {hasCards ? (
              <CubePrimerModalButton
                modalprops={{ cube }}
                className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
              >
                <PencilIcon size={16} />
                Edit Primer
              </CubePrimerModalButton>
            ) : (
              <Tooltip text="Please add at least one card to the cube in order to edit the primer. This is a spam prevention mechanism.">
                <span className="flex items-center gap-2 opacity-50 cursor-not-allowed px-2">
                  <PencilIcon size={16} />
                  Edit Primer
                </span>
              </Tooltip>
            )}
          </Flexbox>
        )}
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
