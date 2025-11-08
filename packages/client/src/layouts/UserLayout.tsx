import React, { useContext } from 'react';

import classNames from 'classnames';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import ErrorBoundary from 'components/ErrorBoundary';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import FollowersModal from 'components/modals/FollowersModal';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import User from '@utils/datatypes/User';

interface UserLayoutProps {
  user: User;
  followersCount: number;
  following: boolean;
  activeLink: string;
  children?: React.ReactNode;
  hasControls?: boolean;
}

const tabs = [
  {
    label: 'Cubes',
    href: '/user/view',
  },
  {
    label: 'Decks',
    href: '/user/decks',
  },
  {
    label: 'Blog',
    href: '/user/blog',
  },
];

const FollowersModalLink = withModal(Link, FollowersModal);
const ConfirmActionModalButton = withModal(Button, ConfirmActionModal);

const UserLayout: React.FC<UserLayoutProps> = ({
  user,
  followersCount,
  following,
  activeLink,
  children,
  hasControls = false,
}) => {
  const activeUser = useContext(UserContext)!;
  const canEdit = activeUser && activeUser.id === user.id;

  const numFollowers = followersCount;
  const followersText = (
    <Text semibold sm>
      {numFollowers} {numFollowers === 1 ? 'follower' : 'followers'}
    </Text>
  );
  return (
    <>
      <div
        className={classNames('bg-bg-accent border-r border-l border-b border-border', {
          'rounded-b-md': !hasControls,
        })}
      >
        <Banner className="px-2" />

        <Flexbox direction="row" className="px-4" justify="between" wrap="wrap">
          <Flexbox direction="col" gap="2" className="my-2">
            <Text semibold md>
              {user.username}
            </Text>
            {numFollowers > 0 ? (
              <FollowersModalLink href="#" modalprops={{ id: user.id, type: 'user' }}>
                {followersText}
              </FollowersModalLink>
            ) : (
              followersText
            )}
            {!following && !canEdit && (
              <Button type="link" color="accent" className="rounded-0 w-full" href={`/user/follow/${user.id}`}>
                Follow
              </Button>
            )}
            {following && !canEdit && (
              <Button
                type="link"
                color="danger"
                outline
                className="rounded-0 w-full"
                href={`/user/unfollow/${user.id}`}
              >
                Unfollow
              </Button>
            )}
            <ConfirmActionModalButton
              color="danger"
              block
              modalprops={{
                title: 'Report User',
                message:
                  'Are you sure you want to report this user? A moderator will review the report and take appropriate action.',
                target: `/user/report/${user.id}`,
                buttonText: 'Report User',
              }}
            >
              Report User
            </ConfirmActionModalButton>
          </Flexbox>
          <Tabs
            tabs={tabs.map((tab) => ({
              label: tab.label,
              href: tab.href + '/' + user.id,
            }))}
            activeTab={tabs.findIndex((tab) => tab.href.includes(activeLink))}
          />
        </Flexbox>
      </div>
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
};

export default UserLayout;
