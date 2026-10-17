import React, { useCallback, useContext, useState } from 'react';

import { PencilIcon } from '@primer/octicons-react';
import { findTabIndexBySlug, PrimerTab, slugifyTabTitle, validatePrimerTabs } from '@utils/primerTabs';

import PrimerTabBar, { TAB_PANEL_ID } from 'components/about/PrimerTabBar';
import PrimerTabsEditor from 'components/about/PrimerTabsEditor';
import Alert from 'components/base/Alert';
import { Card, CardBody } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import LoadingButton from 'components/LoadingButton';
import { SafeMarkdown } from 'components/Markdown';
import TagInput from 'components/TagInput';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import useQueryParam from 'hooks/useQueryParam';

interface PrimerViewProps {
  primerTabs: PrimerTab[];
  tags?: string[];
}

interface AlertProps {
  color: string;
  message: string;
}

const PrimerView: React.FC<PrimerViewProps> = ({ primerTabs, tags }) => {
  const { cube, canEdit } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [tabSlug, setTabSlug] = useQueryParam('tab', '');
  const [isEditing, setIsEditing] = useState(false);
  const [editTabs, setEditTabs] = useState<PrimerTab[]>(primerTabs);
  const [editSelected, setEditSelected] = useState(0);
  const [editTags, setEditTags] = useState<string[]>(tags || []);
  const [alerts, setAlerts] = useState<AlertProps[]>([]);

  const hasCards = cube?.cardCount > 0;
  const selected = findTabIndexBySlug(primerTabs, tabSlug);
  const selectedTab = primerTabs[selected];
  const editError = isEditing ? validatePrimerTabs(editTabs) : null;
  const hasTabBar = primerTabs.length > 1;
  const content = selectedTab?.content && (
    <Card>
      <CardBody>
        <SafeMarkdown markdown={selectedTab.content} />
      </CardBody>
    </Card>
  );

  const selectTab = (index: number) => {
    const tab = primerTabs[index];
    setTabSlug(index === 0 || !tab ? '' : slugifyTabTitle(tab.title));
  };

  const saveChanges = useCallback(async () => {
    setAlerts([]);

    const response = await csrfFetch(`/cube/api/editprimer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: cube.id,
        primerTabs: editTabs,
        tags: editTags,
        activeTab: editSelected,
      }),
    });

    const body = await response.json();
    if (response.ok) {
      window.location.replace(body.redirect);
    } else {
      setAlerts([{ color: 'danger', message: body.error }]);
    }
  }, [csrfFetch, cube.id, editTabs, editTags, editSelected]);

  const handleEditClick = () => {
    setEditTabs(primerTabs);
    setEditSelected(selected);
    setEditTags(tags || []);
    setAlerts([]);
    setIsEditing(true);
  };

  return (
    <Container lg disableCenter className="flex justify-start">
      <Flexbox direction="col" gap="2" className="mb-2 w-full">
        {/* Edit Primer / Save Changes Button */}
        {canEdit && (
          <Flexbox direction="row" gap="2" alignItems="center" justify="start" className="px-2" wrap="wrap">
            {hasCards ? (
              isEditing ? (
                <Flexbox direction="col" gap="1">
                  <LoadingButton
                    color="primary"
                    onClick={saveChanges}
                    disabled={editError !== null}
                    className="flex items-center gap-2"
                  >
                    Save Changes
                  </LoadingButton>
                  {editError && (
                    <Text sm className="text-red-500">
                      {editError}
                    </Text>
                  )}
                </Flexbox>
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

        {/* Content - Edit or Display */}
        {isEditing ? (
          <PrimerTabsEditor
            tabs={editTabs}
            setTabs={setEditTabs}
            selected={editSelected}
            setSelected={setEditSelected}
          />
        ) : (
          <>
            <PrimerTabBar tabs={primerTabs} selected={selected} onSelect={selectTab} />
            {hasTabBar ? (
              <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={`primer-tab-${selected}`} tabIndex={0}>
                {content}
              </div>
            ) : (
              content
            )}
          </>
        )}
      </Flexbox>
    </Container>
  );
};

export default PrimerView;
