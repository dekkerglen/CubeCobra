import React, { useCallback, useContext, useMemo, useState } from 'react';

import type { ArchetypeName, ArchetypeNameSource, ArchetypeTopic } from '@utils/drafting/topicArchetypes';

import AdminTabData from 'components/admin/AdminTabData';
import Badge from 'components/base/Badge';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import useAlerts, { Alerts } from 'hooks/UseAlerts';

interface ArchetypesProps {
  version: string;
  topics: ArchetypeTopic[];
  names: Record<string, ArchetypeName>;
}

// Matches MAX_ARCHETYPE_NAME_LENGTH in the server's admin/archetypes route.
const MAX_NAME_LENGTH = 40;

const SOURCE_BADGES: Record<ArchetypeNameSource, { color: 'secondary' | 'info' | 'success'; text: string }> = {
  auto: { color: 'secondary', text: 'Auto' },
  llm: { color: 'info', text: 'LLM' },
  edited: { color: 'success', text: 'Edited' },
};

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const nameError = (value: string): string | null => {
  const name = value.trim();
  if (!name) return 'Required';
  if (name.length > MAX_NAME_LENGTH) return `${MAX_NAME_LENGTH} characters max`;
  return null;
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-1.5 py-0.5 rounded bg-bg-active text-xs whitespace-nowrap">{children}</span>
);

const Archetypes: React.FC<ArchetypesProps> = ({ version, topics, names: initialNames }) => {
  const { callApi } = useContext(CSRFContext);
  const { alerts, addAlert, dismissAlerts } = useAlerts();
  const [names, setNames] = useState(initialNames);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(topics.map((topic) => [topic.id, initialNames[topic.id]?.name ?? ''])),
  );
  const [saving, setSaving] = useState(false);

  const sortedTopics = useMemo(() => [...topics].sort((a, b) => b.deckShare - a.deckShare), [topics]);

  const changed = useMemo(
    () => topics.filter((topic) => (drafts[topic.id] ?? '').trim() !== (names[topic.id]?.name ?? '')),
    [drafts, names, topics],
  );
  const invalid = changed.some((topic) => nameError(drafts[topic.id] ?? '') !== null);

  const save = useCallback(async () => {
    dismissAlerts();
    setSaving(true);
    try {
      const body = { version, names: Object.fromEntries(changed.map((topic) => [topic.id, drafts[topic.id]])) };
      const response = await callApi('/admin/archetypes/save', body);
      const data = await response.json();
      if (data.success) {
        setNames(data.names);
        setDrafts((current) =>
          Object.fromEntries(Object.entries(current).map(([id, value]) => [id, data.names[id]?.name ?? value])),
        );
        addAlert('success', 'Saved');
      } else {
        addAlert('danger', data.error || 'Request failed');
      }
    } catch (err) {
      addAlert('danger', err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  }, [addAlert, callApi, changed, dismissAlerts, drafts, version]);

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" alignItems="center" justify="between" gap="2" wrap="wrap">
          <Text semibold xl>
            Archetypes
          </Text>
          {topics.length > 0 && (
            <Button color="primary" disabled={saving || changed.length === 0 || invalid} onClick={save}>
              {saving ? <Spinner sm /> : `Save${changed.length > 0 ? ` (${changed.length})` : ''}`}
            </Button>
          )}
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="4">
          <Alerts alerts={alerts} />
          <Flexbox direction="col" gap="1">
            <Text sm className="text-text-secondary">
              Served Version
            </Text>
            <Text semibold md>
              {version}
            </Text>
          </Flexbox>
          {topics.length === 0 ? (
            <Text className="text-center py-8 text-text-secondary">No archetypes found.</Text>
          ) : (
            <Table
              headers={['Name', 'Source', 'Top Tags', 'Decks']}
              wrapCells
              rows={sortedTopics.map((topic) => {
                const draft = drafts[topic.id] ?? '';
                const error = draft.trim() !== (names[topic.id]?.name ?? '') ? nameError(draft) : null;
                const badge = SOURCE_BADGES[names[topic.id]?.source ?? 'auto'];
                return {
                  Name: (
                    <Flexbox direction="col" gap="1" className="min-w-[12rem]">
                      <Input
                        value={draft}
                        valid={error ? false : undefined}
                        onChange={(event) => setDrafts((current) => ({ ...current, [topic.id]: event.target.value }))}
                      />
                      {error && <span className="text-xs text-red-600">{error}</span>}
                    </Flexbox>
                  ),
                  Source: <Badge color={badge.color}>{badge.text}</Badge>,
                  'Top Tags': (
                    <span className="flex flex-wrap gap-1">
                      {topic.topTags.map((tag) => (
                        <Pill key={tag}>{tag}</Pill>
                      ))}
                    </span>
                  ),
                  Decks: percent(topic.deckShare),
                };
              })}
            />
          )}
        </Flexbox>
      </CardBody>
    </Card>
  );
};

const ArchetypesTab: React.FC = () => (
  <AdminTabData<ArchetypesProps> url="/admin/archetypes/data">
    {({ version, topics, names }) => <Archetypes version={version} topics={topics} names={names} />}
  </AdminTabData>
);

export default ArchetypesTab;
