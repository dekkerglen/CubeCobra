import React, { useContext } from 'react';

import { PencilIcon } from '@primer/octicons-react';
import User, { UserRoles } from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import PostButton from 'components/base/PostButton';
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
  { label: 'Collaborations', href: '/user/collaborations', key: 'collaborations' },
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
    <div className="bg-bg-accent border border-border rounded-md overflow-hidden">
      <div className="grid grid-cols-[auto_1fr] gap-3 p-3 lg:block lg:p-0">
        {user.image && (
          <div className="relative sm:row-span-2">
            <img
              className="w-28 h-28 sm:w-52 sm:h-52 lg:w-full lg:h-auto lg:aspect-square object-cover rounded-md lg:rounded-none"
              alt={`Art by ${user.image.artist}`}
              title={`Art by ${user.image.artist}`}
              src={user.image.uri}
            />
            {user.image.artist && (
              <em className="absolute bottom-1 right-2 text-[10px] text-white/90 text-shadow">
                Art by {user.image.artist}
              </em>
            )}
          </div>
        )}
        <Flexbox direction="col" gap="3" className="min-w-0 lg:px-3 lg:pt-3">
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
        </Flexbox>

        <div className="col-span-2 sm:col-span-1 sm:col-start-2 lg:px-3 lg:pt-3">
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
                <PostButton action={`/user/unfollow/${user.id}`} color="danger" outline block>
                  Unfollow
                </PostButton>
              ) : (
                <PostButton action={`/user/follow/${user.id}`} color="accent" block>
                  Follow
                </PostButton>
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
        </div>
      </div>

      <div className="border-t border-border px-3 pb-3 pt-3">
        <SafeMarkdown markdown={user.about || '_This user has not yet filled out their about section._'} />
      </div>
    </div>
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
