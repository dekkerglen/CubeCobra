import React, { useCallback, useContext, useState } from 'react';

import Cube, { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import CursorPagination from 'components/base/CursorPagination';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';
import { clampPage, getIndefinitePageCount, handleIndefinitePageSelection } from 'utils/indefinitePagination';

// Mirrors PendingInvite in packages/server/src/serverutils/collaborations.ts.
interface PendingInvite {
  cubeId: string;
  cubeShortId?: string;
  cubeName: string;
  cubeImageUri?: string;
  cubeVisibility: string;
  ownerId?: string;
  ownerUsername: string;
  invitedById?: string;
  invitedByUsername: string;
  invitedAt: number;
}

// A deleted user has no id and no profile, so their placeholder name stays plain text.
const UserLink: React.FC<{ id?: string; username: string }> = ({ id, username }) =>
  id ? <Link href={`/user/view/${encodeURIComponent(id)}`}>{username}</Link> : <>{username}</>;

interface UserCollaborationsPageProps {
  owner: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  cubes: Cube[];
  nextOffset: number;
  hasMore: boolean;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
  pendingInvites?: PendingInvite[];
}

const PAGE_SIZE = 36;

export const UserCollaborationsPage: React.FC<UserCollaborationsPageProps> = ({
  owner,
  followersCount,
  followingCount,
  following,
  cubes: initialCubes,
  nextOffset: initialOffset,
  hasMore: initialHasMore,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
  pendingInvites: initialPendingInvites = [],
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Cube[]>(initialCubes);
  const [offset, setOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(initialPendingInvites);
  const [busyInvites, setBusyInvites] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);

  // This endpoint pages by numeric offset with an explicit hasMore flag rather than by cursor, so
  // fetchIndefiniteMoreData (which is built around a lastKey) does not apply. The page the user
  // asked for is still threaded through and clamped to what the fetch actually produced.
  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      setLoading(true);

      const response = await csrfFetch(`/user/getmorecollaborations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: owner.id,
          offset,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          const newItems = [...items, ...json.cubes];
          setItems(newItems);
          setPage(clampPage(targetPage, getIndefinitePageCount(newItems, PAGE_SIZE)));
          setOffset(json.nextOffset);
          setHasMore(json.hasMore);
        }
      }

      setLoading(false);
    },
    [csrfFetch, owner.id, offset, items],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData,
        });
      }}
      loading={loading}
    />
  );

  const isOwner = !!user && user.id === owner.id;

  // These endpoints key on the full cube id; the short id is only for the link.
  const respondToInvite = async (invite: PendingInvite, action: 'accept' | 'decline') => {
    setBusyInvites((current) => new Set(current).add(invite.cubeId));
    setInviteError(null);
    setInviteNotice(null);
    try {
      const response = await csrfFetch(
        `/cube/api/collaborators/${encodeURIComponent(invite.cubeId)}/invite/${action}`,
        { method: 'POST' },
      );
      const json = await response.json().catch(() => ({}));
      if (response.ok && json.success === 'true') {
        setPendingInvites((current) => current.filter((i) => i.cubeId !== invite.cubeId));
        if (action === 'accept') {
          // Reload so the newly joined cube shows in the grid and the navbar.
          window.location.reload();
        }
        return;
      }
      // 403/404 mean the invite was cancelled or the cube deleted since the page loaded.
      if (response.status === 403 || response.status === 404) {
        setPendingInvites((current) => current.filter((i) => i.cubeId !== invite.cubeId));
        setInviteNotice('This invite is no longer available.');
        return;
      }
      setInviteError(json.message || `Failed to ${action} invite.`);
    } catch {
      setInviteError(`Failed to ${action} invite.`);
    } finally {
      setBusyInvites((current) => {
        const next = new Set(current);
        next.delete(invite.cubeId);
        return next;
      });
    }
  };

  return (
    <MainLayout>
      <UserLayout
        user={owner}
        followersCount={followersCount}
        followingCount={followingCount}
        following={following}
        activeLink="collaborations"
        patronLevel={patronLevel}
        likedCubesCount={likedCubesCount}
        likedPackagesCount={likedPackagesCount}
      >
        <DynamicFlash />
        {isOwner && pendingInvites.length > 0 && (
          <section aria-labelledby="pending-invites-heading" className="mt-3">
            <Flexbox direction="col" gap="2">
              <Text lg semibold id="pending-invites-heading">
                Pending invites
              </Text>
              {inviteError && <Alert color="danger">{inviteError}</Alert>}
              {inviteNotice && <Alert color="info">{inviteNotice}</Alert>}
              {pendingInvites.map((invite) => {
                const busy = busyInvites.has(invite.cubeId);
                return (
                  <Flexbox key={invite.cubeId} direction="row" alignItems="center" gap="2" className="py-1">
                    {invite.cubeImageUri ? (
                      <img src={invite.cubeImageUri} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-bg-secondary flex-shrink-0" />
                    )}
                    <Flexbox direction="col" className="flex-1 min-w-0">
                      {invite.cubeVisibility === CUBE_VISIBILITY.PRIVATE ? (
                        <Text>{invite.cubeName}</Text>
                      ) : (
                        <Link href={`/cube/list/${encodeURIComponent(invite.cubeShortId ?? invite.cubeId)}`}>
                          {invite.cubeName}
                        </Link>
                      )}
                      <Text sm className="text-text-secondary">
                        by <UserLink id={invite.ownerId} username={invite.ownerUsername} /> · Invited by{' '}
                        <UserLink id={invite.invitedById} username={invite.invitedByUsername} />
                      </Text>
                    </Flexbox>
                    <Button
                      color="primary"
                      onClick={() => respondToInvite(invite, 'accept')}
                      disabled={busy}
                      aria-label={`Accept invite to ${invite.cubeName}`}
                    >
                      Accept
                    </Button>
                    <Button
                      color="secondary"
                      onClick={() => respondToInvite(invite, 'decline')}
                      disabled={busy}
                      aria-label={`Decline invite to ${invite.cubeName}`}
                    >
                      Decline
                    </Button>
                  </Flexbox>
                );
              })}
            </Flexbox>
          </section>
        )}
        <Flexbox direction="col" className="mt-3" gap="2">
          <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap" className="w-full">
            <Text lg semibold>
              Collaborations
            </Text>
            {pager}
          </Flexbox>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 5xl:grid-cols-6">
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
              <CubePreview key={cube.id} cube={cube} pinToggle={isOwner} />
            ))}
          </div>
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
            {pager}
          </Flexbox>
          {items.length === 0 && (
            <Text className="text-text-secondary">
              {isOwner
                ? 'You are not a collaborator on any cubes yet.'
                : 'This user is not a collaborator on any cubes yet.'}
            </Text>
          )}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserCollaborationsPage);
