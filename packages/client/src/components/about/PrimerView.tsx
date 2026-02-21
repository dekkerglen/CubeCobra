import React, { useCallback, useContext, useState } from 'react';

import { PencilIcon } from '@primer/octicons-react';

import Alert from 'components/base/Alert';
import { Card, CardBody } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Tooltip from 'components/base/Tooltip';
import LoadingButton from 'components/LoadingButton';
import { SafeMarkdown } from 'components/Markdown';
import TagInput from 'components/TagInput';
import TextEntry from 'components/TextEntry';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

interface PrimerViewProps {
  description: string | null;
  tags?: string[];
}

interface AlertProps {
  color: string;
  message: string;
}

const PrimerView: React.FC<PrimerViewProps> = ({ description, tags }) => {
  const user = useContext(UserContext);
  const { cube } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(description || '');
  const [editTags, setEditTags] = useState<string[]>(tags || []);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);

  const isOwner = user && cube && user.id === cube.owner.id;
  const hasCards = cube?.cardCount > 0;

  const saveChanges = useCallback(async () => {
    setAlerts([]);

    const response = await csrfFetch(`/cube/api/editprimer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: cube.id,
        description: editDescription,
        tags: editTags,
      }),
    });

    const body = await response.json();
    if (response.ok) {
      window.location.replace(body.redirect);
    } else {
      setAlerts([{ color: 'danger', message: body.error }]);
    }
  }, [csrfFetch, cube.id, editDescription, editTags]);

  const handleEditClick = () => {
    setEditDescription(description || '');
    setEditTags(tags || []);
    setAlerts([]);
    setIsEditing(true);
  };

  return (
    <Container lg disableCenter className="flex justify-start">
      <Flexbox direction="col" gap="2" className="mb-2 w-full">
        {/* Edit Primer / Save Changes Button */}
        {isOwner && (
          <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
            {hasCards ? (
              isEditing ? (
                <LoadingButton color="primary" onClick={saveChanges} className="flex items-center gap-2">
                  Save Changes
                </LoadingButton>
              ) : (
                <a
                  onClick={handleEditClick}
                  className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2"
                >
                  <PencilIcon size={16} />
                  Edit Primer
                </a>
              )
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

        {/* Alerts */}
        {alerts.map(({ color, message }) => (
          <Alert key={message} color={color} className="mt-2">
            {message}
          </Alert>
        ))}

        {/* Tags - Edit or Display */}
        {isEditing ? (
          <Flexbox direction="col" gap="2" className="px-2">
            <TagInput
              label="Tags"
              tags={editTags.map((tag) => ({ text: tag, id: tag }))}
              addTag={(tag) => {
                if (!editTags.includes(tag.text)) {
                  setEditTags([...editTags, tag.text]);
                }
              }}
              deleteTag={(index) => {
                const newTags = [...editTags];
                newTags.splice(index, 1);
                setEditTags(newTags);
              }}
            />
          </Flexbox>
        ) : (
          tags &&
          tags.length > 0 && (
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
          )
        )}

        {/* Description - Edit or Display */}
        {isEditing ? (
          <Flexbox direction="col" gap="2" className="px-2">
            <TextEntry
              name="description"
              value={editDescription}
              setValue={setEditDescription}
              maxLength={100000}
              rows={20}
            />
          </Flexbox>
        ) : (
          description && (
            <Card>
              <CardBody>
                <SafeMarkdown markdown={description} />
              </CardBody>
            </Card>
          )
        )}
      </Flexbox>
    </Container>
  );
};

export default PrimerView;
