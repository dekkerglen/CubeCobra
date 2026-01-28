import React, { useContext } from 'react';

import BlogPostType from '@utils/datatypes/BlogPost';
import Cube, { CubeCards } from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Tooltip from 'components/base/Tooltip';
import BlogPost from 'components/blog/BlogPost';
import CubeOverviewCard from 'components/cube/CubeOverviewCard';
import DynamicFlash from 'components/DynamicFlash';
import CubeOverviewModal from 'components/modals/CubeOverviewModal';
import CubeSettingsModal from 'components/modals/CubeSettingsModal';
import CustomizeBasicsModal from 'components/modals/CustomizeBasicsModal';
import DeleteCubeModal from 'components/modals/DeleteCubeModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import useAlerts from 'hooks/UseAlerts';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

const CubeOverviewModalLink = withModal(Link, CubeOverviewModal);
const CubeSettingsModalLink = withModal(Link, CubeSettingsModal);
const DeleteCubeModalLink = withModal(Link, DeleteCubeModal);
const CustomizeBasicsModalLink = withModal(Link, CustomizeBasicsModal);

interface CubeOverviewProps {
  post: BlogPostType;
  priceOwned: number;
  pricePurchase: number;
  cube: Cube;
  cards: CubeCards;
  followed: boolean;
  followersCount: number;
}

const CubeOverview: React.FC<CubeOverviewProps> = ({
  post,
  cards,
  priceOwned,
  pricePurchase,
  cube,
  followed,
  followersCount,
}) => {
  const user = useContext(UserContext);
  const { alerts, addAlert } = useAlerts();

  const controls = user && cube.owner.id === user.id ? (
    <Flexbox direction="col" gap="2" className="px-2">
      {(cube.cardCount > 0 && (
        <CubeOverviewModalLink
          modalprops={{
            cube: cube,
          }}
        >
          Edit Overview
        </CubeOverviewModalLink>
      )) || (
        <Tooltip text="Please add at least one card to the cube in order to edit the overview. This is a spam prevention mechanism.">
          Edit Overview
        </Tooltip>
      )}
      <CubeSettingsModalLink modalprops={{ addAlert, onCubeUpdate: () => {} }}>
        Edit Settings
      </CubeSettingsModalLink>
      <CustomizeBasicsModalLink
        modalprops={{
          cube: cube,
          onError: (message: string) => {
            addAlert('danger', message);
          },
        }}
      >
        Customize basics
      </CustomizeBasicsModalLink>
      <Link href={`/cube/restore/${encodeURIComponent(getCubeId(cube))}`}>Restore</Link>
      <DeleteCubeModalLink modalprops={{ cube }}>Delete Cube</DeleteCubeModalLink>
    </Flexbox>
  ) : undefined;

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cards={cards} cube={cube} activeLink="primer" controls={controls}>
        <Flexbox direction="col" gap="2" className="mb-2">
          <DynamicFlash />
          {alerts.map(({ color, message }, index) => (
            <div className={`alert alert-${color}`} key={index}>
              {message}
            </div>
          ))}
          <CubeOverviewCard
            priceOwned={priceOwned}
            pricePurchase={pricePurchase}
            followersCount={followersCount}
            followed={followed}
          />
          {post && <BlogPost key={post.id} post={post} />}
          {post && (
            <Button color="primary" block href={`/cube/blog/${cube.id}`} type="link">
              View All Blog Posts
            </Button>
          )}
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeOverview);
