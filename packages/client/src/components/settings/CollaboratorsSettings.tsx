import React, { useCallback, useContext, useEffect, useState } from 'react';

import { TrashIcon } from '@primer/octicons-react';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';

interface CollaboratorEntry {
  id: string;
  username: string;
  imageUri: string | null;
}

const CollaboratorsSettings: React.FC = () => {
  const { cube, setCube, isOwner } = useContext(CubeContext);
  const { csrfToken } = useContext(CSRFContext);
  const user = useContext(UserContext);

  const [usernameInput, setUsernameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Fetch collaborator details from server on mount
  useEffect(() => {
    if (!cube.id) return;
    setFetchLoading(true);
    fetch(`/cube/api/collaborators/${cube.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success === 'true') setCollaborators(data.collaborators);
      })
      .catch(() => {})
      .finally(() => setFetchLoading(false));
  }, [cube.id]);

  const handleAdd = useCallback(async () => {
    const username = usernameInput.trim();
    if (!username) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/cube/api/collaborators/${cube.id}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? 'Failed to add collaborator');
        return;
      }

      const newEntry: CollaboratorEntry = data.collaborator;
      setCollaborators((prev) => [...prev, newEntry]);
      setCube((prev) => ({ ...prev, collaborators: [...(prev.collaborators ?? []), newEntry.id] }));
      setUsernameInput('');
      setSuccess(`${newEntry.username} added as a collaborator.`);
    } finally {
      setLoading(false);
    }
  }, [usernameInput, cube.id, setCube, csrfToken]);

  const handleRemove = useCallback(
    async (userId: string) => {
      setError(null);
      setSuccess(null);
      setConfirmRemoveId(null);

      try {
        const res = await fetch(`/cube/api/collaborators/${cube.id}/${userId}`, {
          method: 'DELETE',
          headers: { 'CSRF-Token': csrfToken },
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.message ?? 'Failed to remove collaborator');
          return;
        }

        setCollaborators((prev) => prev.filter((c) => c.id !== userId));
        setCube((prev) => ({ ...prev, collaborators: (prev.collaborators ?? []).filter((id) => id !== userId) }));
      } catch {
        setError('Failed to remove collaborator');
      }
    },
    [cube.id, setCube, csrfToken],
  );

  return (
    <Card>
      <CardHeader>
        <Text semibold lg>
          Collaborators
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="4">
          <Text sm className="text-text-secondary">
            Collaborators can add, remove, and edit cards in this cube. Only the owner can add or remove others;
            collaborators can remove themselves.
          </Text>

          {error && <Alert color="danger">{error}</Alert>}
          {success && <Alert color="success">{success}</Alert>}

          {/* Current collaborators */}
          {fetchLoading ? (
            <Text sm className="text-text-secondary italic">
              Loading…
            </Text>
          ) : collaborators.length === 0 ? (
            <Text sm className="text-text-secondary italic">
              No collaborators yet.
            </Text>
          ) : (
            <Flexbox direction="col" gap="2">
              {collaborators.map((c) => (
                <Flexbox key={c.id} direction="row" alignItems="center" gap="2" className="py-1">
                  {c.imageUri ? (
                    <img src={c.imageUri} alt={c.username} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-bg-secondary flex-shrink-0" />
                  )}
                  <Text sm className="flex-1">
                    {c.username}
                  </Text>
                  {(isOwner || user?.id === c.id) &&
                    (confirmRemoveId === c.id ? (
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <Text sm className="text-text-secondary">
                          Remove?
                        </Text>
                        <Button color="danger" onClick={() => handleRemove(c.id)}>
                          Yes
                        </Button>
                        <Button color="secondary" onClick={() => setConfirmRemoveId(null)}>
                          No
                        </Button>
                      </Flexbox>
                    ) : (
                      <button
                        type="button"
                        className="text-text-secondary hover:text-danger transition-colors"
                        onClick={() => setConfirmRemoveId(c.id)}
                        aria-label={`Remove ${c.username}`}
                      >
                        <TrashIcon size={16} />
                      </button>
                    ))}
                </Flexbox>
              ))}
            </Flexbox>
          )}

          {/* Add collaborator — owner only */}
          {isOwner && (
            <Flexbox direction="row" gap="2" alignItems="end">
              <div className="flex-1">
                <Input
                  label="Add by username"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Exact username"
                  disabled={fetchLoading}
                />
              </div>
              <Button color="primary" onClick={handleAdd} disabled={loading || fetchLoading || !usernameInput.trim()}>
                {loading ? 'Adding…' : 'Add'}
              </Button>
            </Flexbox>
          )}
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default CollaboratorsSettings;
