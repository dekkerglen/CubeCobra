import React, { useContext } from 'react';

import { PencilIcon } from '@primer/octicons-react';
import User, { UserRoles } from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import ErrorBoundary from 'components/ErrorBoundary';
import { SafeMarkdown } from 'components/Markdown';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import AdminBadge from 'components/user/AdminBadge';
import { PatronBadge, PatronTierBadge } from 'components/user/PatronBadge';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';

interface UserLayoutProps {
  user: User;
  followersCount: number;
  followingCount: number;
  following: boolean;
  activeLink: string;
  patronLevel?: number;
  likedCubesCount?: number;
  likedPackagesCount?: number;
  children?: React.ReactNode;
}

const tabs = [
  { label: 'Cubes', href: '/user/view', key: 'view' },
  { label: 'Packages', href: '/user/packages', key: 'packages' },
  { label: 'Drafts', href: '/user/decks', key: 'decks' },
  { label: 'Blog Posts', href: '/user/blog', key: 'blog' },
];

const ConfirmActionModalButton = withModal(Button, ConfirmActionModal);

const UserLayout: React.FC<UserLayoutProps> = ({
  user,
  followersCount,
  followingCount,
  following,
  activeLink,
  patronLevel,
  likedCubesCount,
  likedPackagesCount,
  children,
}) => {
  const activeUser = useContext(UserContext);
  const canEdit = !!activeUser && activeUser.id === user.id;
  const isAdmin = Array.isArray(user.roles) && user.roles.includes(UserRoles.ADMIN);

  const userCard = (
    <Flexbox direction="col" gap="3" className="bg-bg-accent border border-border rounded-md overflow-hidden">
      {user.image && (
        <div className="relative">
          <img className="w-full aspect-square object-cover" alt={`Art by ${user.image.artist}`} src={user.image.uri} />
          {user.image.artist && (
            <em className="absolute bottom-1 right-2 text-[10px] text-white/90 text-shadow">
              Art by {user.image.artist}
            </em>
          )}
        </div>
      )}
      <Flexbox direction="col" gap="3" className="px-3 pb-3 pt-3">
        <Text semibold lg>
          {user.username}
        </Text>
        {(isAdmin || typeof patronLevel === 'number') && (
          <Flexbox direction="row" gap="2" wrap="wrap">
            {isAdmin && <AdminBadge />}
            {typeof patronLevel === 'number' && (
              <>
                <PatronBadge />
                <PatronTierBadge level={patronLevel} />
              </>
            )}
          </Flexbox>
        )}

        <Flexbox direction="row" gap="3" wrap="wrap">
          <a href={`/user/followers/${user.id}`} className="hover:underline whitespace-nowrap text-sm">
            <span className="font-semibold">{followersCount}</span>{' '}
            <span className="text-text-secondary">{followersCount === 1 ? 'Follower' : 'Followers'}</span>
          </a>
          <a href={`/user/following/${user.id}`} className="hover:underline whitespace-nowrap text-sm">
            <span className="font-semibold">{followingCount}</span>{' '}
            <span className="text-text-secondary">Following</span>
          </a>
          {typeof likedCubesCount === 'number' && (
            <a href={`/cube/liked/${user.id}`} className="hover:underline whitespace-nowrap text-sm">
              <span className="font-semibold">{likedCubesCount}</span>{' '}
              <span className="text-text-secondary">Liked Cubes</span>
            </a>
          )}
          {typeof likedPackagesCount === 'number' && (
            <a href={`/packages/liked/${user.id}`} className="hover:underline whitespace-nowrap text-sm">
              <span className="font-semibold">{likedPackagesCount}</span>{' '}
              <span className="text-text-secondary">Liked Packages</span>
            </a>
          )}
        </Flexbox>

        {canEdit ? (
          <Button type="link" color="accent" href="/user/account" block>
            <Flexbox direction="row" gap="2" alignItems="center" justify="center">
              <PencilIcon size={14} />
              <span>Edit Profile</span>
            </Flexbox>
          </Button>
        ) : (
          <Flexbox direction="col" gap="2">
            {following ? (
              <Button type="link" color="danger" outline href={`/user/unfollow/${user.id}`} block>
                Unfollow
              </Button>
            ) : (
              <Button type="link" color="accent" href={`/user/follow/${user.id}`} block>
                Follow
              </Button>
            )}
            <ConfirmActionModalButton
              color="danger"
              outline
              block
              modalprops={{
                title: 'Report User',
                message:
                  'Are you sure you want to report this user? A moderator will review the report and take appropriate action.',
                target: `/user/report/${user.id}`,
                buttonText: 'Report User',
              }}
            >
              Report
            </ConfirmActionModalButton>
          </Flexbox>
        )}

        <div className="border-t border-border pt-3">
          <SafeMarkdown markdown={user.about || '_This user has not yet filled out their about section._'} />
        </div>
      </Flexbox>
    </Flexbox>
  );

  const activeIndex = tabs.findIndex((tab) => tab.key === activeLink);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 my-3">
      <div className="lg:col-span-1">{userCard}</div>
      <div className="lg:col-span-3 min-w-0">
        <Tabs
          tabs={tabs.map((tab) => ({ label: tab.label, href: `${tab.href}/${user.id}` }))}
          activeTab={activeIndex}
          className="border-b border-border"
        />
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
};

export default UserLayout;
