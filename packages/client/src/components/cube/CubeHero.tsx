import React, { useContext } from 'react';
import { useState } from 'react';

import {
  ArrowSwitchIcon,
  DownloadIcon,
  GearIcon,
  GlobeIcon,
  HeartFillIcon,
  HeartIcon,
  LinkIcon,
  PackageIcon,
  QuestionIcon,
  RssIcon,
  StopIcon,
} from '@primer/octicons-react';
import { cardIsToken, cardName, cardPrice, cardPriceCardKingdom, cardPriceManaPool } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import { getCubeCardCountSnippet, getCubeId } from '@utils/Util';

import BaseUrlContext from '../../contexts/BaseUrlContext';
import { CSRFContext } from '../../contexts/CSRFContext';
import CubeContext from '../../contexts/CubeContext';
import DisplayContext from '../../contexts/DisplayContext';
import UserContext from '../../contexts/UserContext';
import useAlerts from '../../hooks/UseAlerts';
import { cardKingdomBulkLink, getBulkManaPoolLink, tcgMassEntryUrl, tcgplayerAffiliate } from '../../utils/Affiliate';
import Checkbox from '../base/Checkbox';
import Dropdown from '../base/Dropdown';
import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Text from '../base/Text';
import Tooltip from '../base/Tooltip';
import CubeIdModal from '../cube/CubeIdModal';
import Form from '../Form';
import { SafeMarkdown } from '../Markdown';
import ArenaExportModal from '../modals/ArenaExportModal';
import ConfirmActionModal from '../modals/ConfirmActionModal';
import CubeCompareModal from '../modals/CubeCompareModal';
import CubeOverviewModal from '../modals/CubeOverviewModal';
import CubeSettingsModal from '../modals/CubeSettingsModal';
import CustomizeBasicsModal from '../modals/CustomizeBasicsModal';
import DeleteCubeModal from '../modals/DeleteCubeModal';
import FollowersModal from '../modals/FollowersModal';
import withModal from '../WithModal';

const ArenaExportModalItem = withModal('button', ArenaExportModal);
const CompareModalButton = withModal('button', CubeCompareModal);
const ShareCubeButton = withModal('button', CubeIdModal);
const ReportCubeButton = withModal(Link, ConfirmActionModal);
const CubeOverviewModalLink = withModal(Link, CubeOverviewModal);
const CubeSettingsModalLink = withModal(Link, CubeSettingsModal);
const CustomizeBasicsModalLink = withModal(Link, CustomizeBasicsModal);
const DeleteCubeModalLink = withModal(Link, DeleteCubeModal);
const FollowersModalLink = withModal(Link, FollowersModal);

interface CubeHeroProps {
  cube: Cube;
  minified?: boolean;
}

const CubeHero: React.FC<CubeHeroProps> = ({ cube, minified = false }) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const baseUrl = useContext(BaseUrlContext);
  const { addAlert } = useAlerts();
  const isCubeOwner = !!user && cube.owner.id === user.id;
  const [isSortUsed, setIsSortUsed] = useState(true);
  const [isFilterUsed, setIsFilterUsed] = useState(true);
  const [followedState, setFollowedState] = useState(!!user && cube.following && cube.following.includes(user.id));
  const [maskGradient, setMaskGradient] = useState('linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)');
  const [mobileMaskGradient, setMobileMaskGradient] = useState(
    'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
  );
  const [minifiedMaskGradient, setMinifiedMaskGradient] = useState(
    'linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 50%)',
  );
  const [minifiedMobileMaskGradient, setMinifiedMobileMaskGradient] = useState(
    'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
  );
  const heroRef = React.useRef<HTMLDivElement>(null);

  const { showCustomImages, toggleShowCustomImages } = useContext(DisplayContext);

  const { hasCustomImages, unfilteredChangedCards } = useContext(CubeContext);

  const handleFollowToggle = () => {
    if (!user) return;

    if (followedState) {
      setFollowedState(false);
      csrfFetch(`/cube/unfollow/${cube.id}`, {
        method: 'POST',
        headers: {},
      }).then((response) => {
        if (!response.ok) {
          console.error(response);
          setFollowedState(true);
        }
      });
    } else {
      setFollowedState(true);
      csrfFetch(`/cube/follow/${cube.id}`, {
        method: 'POST',
        headers: {},
      }).then((response) => {
        if (!response.ok) {
          console.error(response);
          setFollowedState(false);
        }
      });
    }
  };

  React.useEffect(() => {
    const updateGradient = () => {
      if (!heroRef.current) return;

      const img = new Image();
      img.onload = () => {
        const heroHeight = heroRef.current?.offsetHeight || 0;
        const heroWidth = heroRef.current?.offsetWidth || 0;
        const aspectRatio = img.width / img.height;

        // Desktop gradient calculation (horizontal) for full hero (2x zoom)
        const imageWidth = heroHeight * aspectRatio * 2; // 2x zoom means 2x width
        const imageWidthPercent = (imageWidth / heroWidth) * 100;
        const midpoint = imageWidthPercent / 2;
        const desktopGradient = `linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) ${midpoint}%, rgba(0,0,0,0) ${imageWidthPercent}%)`;
        setMaskGradient(desktopGradient);

        // Desktop gradient calculation (horizontal) for minified hero (6x zoom)
        const minifiedImageWidth = heroHeight * aspectRatio * 6; // 6x zoom means 6x width
        const minifiedImageWidthPercent = (minifiedImageWidth / heroWidth) * 100;
        const minifiedMidpoint = minifiedImageWidthPercent / 2;
        const minifiedDesktopGradient = `linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) ${minifiedMidpoint}%, rgba(0,0,0,0) ${minifiedImageWidthPercent}%)`;
        setMinifiedMaskGradient(minifiedDesktopGradient);

        // Mobile gradient calculation (vertical)
        // Image is sized as 100% width, so height = width / aspectRatio
        const imageHeight = heroWidth / aspectRatio;
        const imageHeightPercent = (imageHeight / heroHeight) * 100;
        const mobileMidpoint = imageHeightPercent / 2;
        // Fade from 50% opacity at top, maintain through midpoint, then fade to transparent at image bottom
        const mobileGradient = `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.5) ${mobileMidpoint}%, rgba(0,0,0,0) ${imageHeightPercent}%)`;
        setMobileMaskGradient(mobileGradient);
        setMinifiedMobileMaskGradient(mobileGradient); // Same for minified on mobile
      };

      img.src = cube.image.uri;
    };

    updateGradient();
    window.addEventListener('resize', updateGradient);

    return () => window.removeEventListener('resize', updateGradient);
  }, [cube.image.uri]);

  // Minified version - just cube name and owner
  if (minified) {
    return (
      <div className="relative w-full bg-hero-bg border-b border-border" style={{ overflow: 'visible' }}>
        {/* Background image on mobile with triple zoom */}
        <div
          className="lg:hidden absolute inset-0"
          style={{
            backgroundImage: `url(${cube.image.uri})`,
            backgroundSize: '100% auto',
            backgroundPosition: 'top center',
            backgroundRepeat: 'no-repeat',
            maskImage: minifiedMobileMaskGradient,
            WebkitMaskImage: minifiedMobileMaskGradient,
          }}
        />
        {/* Background image on desktop with triple zoom */}
        <div
          className="hidden lg:block absolute inset-0"
          style={{
            backgroundImage: `url(${cube.image.uri})`,
            backgroundSize: 'auto 600%',
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
            maskImage: minifiedMaskGradient,
            WebkitMaskImage: minifiedMaskGradient,
          }}
        />
        <div className="relative p-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div>
                <h1 className="text-white font-semibold text-2xl">{cube.name}</h1>
                <Text sm className="text-white/80 mt-1">
                  {getCubeCardCountSnippet(cube)} Cube
                </Text>
              </div>
              <div className="flex items-center gap-2">
                {cube.owner.image && (
                  <a href={`/user/view/${cube.owner.id}`}>
                    <img
                      className="profile-thumbnail"
                      src={cube.owner.image.uri}
                      alt={cube.owner.image.artist}
                      title={cube.owner.image.artist}
                    />
                  </a>
                )}
                <Text sm className="text-white/80">
                  by{' '}
                  <a href={`/user/view/${cube.owner.id}`} className="text-white hover:underline">
                    {cube.owner.username}
                  </a>
                </Text>
              </div>
            </div>
            {isCubeOwner && (
              <div className="flex-shrink-0">
                <Dropdown
                  trigger={
                    <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
                      <span
                        style={{
                          filter: 'drop-shadow(0 0 3px rgba(0, 0, 0, 1)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.8))',
                        }}
                      >
                        <GearIcon size={24} />
                      </span>
                    </button>
                  }
                  align="right"
                  minWidth="16rem"
                >
                  <Flexbox direction="col" gap="2" className="p-3">
                    {(cube.cardCount > 0 && (
                      <CubeOverviewModalLink
                        modalprops={{
                          cube: cube,
                        }}
                        className="!text-text hover:!text-link-active"
                      >
                        Edit Primer
                      </CubeOverviewModalLink>
                    )) || (
                      <Tooltip text="Please add at least one card to the cube in order to edit the primer. This is a spam prevention mechanism.">
                        <span className="!text-text opacity-50 cursor-not-allowed">Edit Primer</span>
                      </Tooltip>
                    )}
                    <CubeSettingsModalLink
                      modalprops={{ addAlert, onCubeUpdate: () => {} }}
                      className="!text-text hover:!text-link-active"
                    >
                      Edit Settings
                    </CubeSettingsModalLink>
                    <CustomizeBasicsModalLink
                      modalprops={{
                        cube: cube,
                        onError: (message: string) => {
                          addAlert('danger', message);
                        },
                      }}
                      className="!text-text hover:!text-link-active"
                    >
                      Customize basics
                    </CustomizeBasicsModalLink>
                    <Link
                      href={`/cube/restore/${encodeURIComponent(getCubeId(cube))}`}
                      className="!text-text hover:!text-link-active"
                    >
                      Restore
                    </Link>
                    <DeleteCubeModalLink modalprops={{ cube }} className="!text-text hover:!text-link-active">
                      Delete Cube
                    </DeleteCubeModalLink>
                    {hasCustomImages && (
                      <>
                        <div className="border-t border-border my-1"></div>
                        <Link onClick={toggleShowCustomImages} className="!text-text hover:!text-link-active">
                          {showCustomImages ? 'Hide Custom Images' : 'Show Custom Images'}
                        </Link>
                      </>
                    )}
                  </Flexbox>
                </Dropdown>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const urlSegment = '';

  const exportMenuItems = (
    <Flexbox direction="col" gap="2" className="p-3">
      {user && (
        <a href={`/cube/clone/${cube.id}`} className="!text-text hover:!text-link-active font-medium">
          Clone Cube
        </a>
      )}
      <a
        href={`/cube/download/plaintext/${cube.id}?${urlSegment}`}
        className="!text-text hover:!text-link-active font-medium"
      >
        Card Names (.txt)
      </a>
      <a
        href={`/cube/download/csv/${cube.id}?${urlSegment}`}
        className="!text-text hover:!text-link-active font-medium"
      >
        Comma-Separated (.csv)
      </a>
      <a
        href={`/cube/download/forge/${cube.id}?${urlSegment}`}
        className="!text-text hover:!text-link-active font-medium"
      >
        Forge (.dck)
      </a>
      <a
        href={`/cube/download/mtgo/${cube.id}?${urlSegment}`}
        className="!text-text hover:!text-link-active font-medium"
      >
        MTGO (.txt)
      </a>
      <a
        href={`/cube/download/xmage/${cube.id}?${urlSegment}`}
        className="!text-text hover:!text-link-active font-medium"
      >
        XMage (.dck)
      </a>
      <ArenaExportModalItem
        modalprops={{ isFilterUsed: isFilterUsed, isSortUsed: isSortUsed }}
        className="!text-text hover:!text-link-active font-medium text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        Arena (.txt)
      </ArenaExportModalItem>
      <Flexbox direction="row" justify="between" onClick={() => setIsSortUsed((is) => !is)} className="cursor-pointer">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox label="Use Sort" checked={isSortUsed} setChecked={setIsSortUsed} />
        </div>
        <Tooltip text="Order export using current sort options." wrapperTag="span" className="ms-auto me-0">
          <QuestionIcon size={16} />
        </Tooltip>
      </Flexbox>
      <Flexbox
        direction="row"
        justify="between"
        onClick={() => setIsFilterUsed((is) => !is)}
        className="cursor-pointer"
      >
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox label="Use Filter" checked={isFilterUsed} setChecked={setIsFilterUsed} />
        </div>
        <Tooltip
          text="Include in export only cards matching current filter."
          wrapperTag="span"
          className="ms-auto me-0"
        >
          <QuestionIcon size={16} />
        </Tooltip>
      </Flexbox>
    </Flexbox>
  );

  const purchaseMenuItems = (
    <Flexbox direction="col" gap="2" className="p-3">
      <a
        href={getBulkManaPoolLink(unfilteredChangedCards.mainboard)}
        target="_blank"
        rel="noopener noreferrer"
        className="!text-text hover:!text-link-active font-medium flex justify-between w-full"
      >
        <span>Mana Pool</span>
        {(() => {
          const price = unfilteredChangedCards.mainboard.reduce((acc, card) => acc + (cardPriceManaPool(card) ?? 0), 0);
          return price > 0 ? <span>${price.toFixed(2)}</span> : null;
        })()}
      </a>
      {(() => {
        const formRef = React.createRef<HTMLFormElement>();
        const getEntry = (card: any): string | null => {
          if (cardIsToken(card)) {
            return `1 ${cardName(card)} Token`;
          }
          if (cardName(card).endsWith('Emblem')) {
            return `1 Emblem - ${cardName(card).replace(' Emblem', '')}`;
          }
          return `1 ${cardName(card)}`;
        };
        const formData = {
          c: unfilteredChangedCards.mainboard
            .map(getEntry)
            .filter((x): x is string => x !== null)
            .join('||'),
          affiliateurl: tcgplayerAffiliate,
        };
        const price = unfilteredChangedCards.mainboard.reduce((acc, card) => acc + (cardPrice(card) ?? 0), 0);
        return (
          <Form method="POST" action={tcgMassEntryUrl} formData={formData} ref={formRef}>
            <button
              type="button"
              onClick={() => formRef.current?.submit()}
              className="!text-text hover:!text-link-active font-medium text-left bg-transparent border-0 p-0 cursor-pointer flex justify-between w-full"
            >
              <span>TCGPlayer</span>
              {price > 0 && <span>${price.toFixed(2)}</span>}
            </button>
          </Form>
        );
      })()}
      {(() => {
        const formRef = React.createRef<HTMLFormElement>();
        const getEntry = (card: any): string | null => {
          if (cardIsToken(card)) {
            return `1 ${cardName(card)} Token`;
          }
          if (cardName(card).endsWith('Emblem')) {
            return `1 Emblem - ${cardName(card).replace(' Emblem', '')}`;
          }
          return `1 ${cardName(card)}`;
        };
        const formData = {
          c: unfilteredChangedCards.mainboard
            .map(getEntry)
            .filter((x): x is string => x !== null)
            .join('||'),
        };
        const price = unfilteredChangedCards.mainboard.reduce(
          (acc, card) => acc + (cardPriceCardKingdom(card) ?? 0),
          0,
        );
        return (
          <Form method="POST" action={cardKingdomBulkLink} formData={formData} ref={formRef}>
            <button
              type="button"
              onClick={() => formRef.current?.submit()}
              className="!text-text hover:!text-link-active font-medium text-left bg-transparent border-0 p-0 cursor-pointer flex justify-between w-full"
            >
              <span>Card Kingdom</span>
              {price > 0 && <span>${price.toFixed(2)}</span>}
            </button>
          </Form>
        );
      })()}
    </Flexbox>
  );

  return (
    <div ref={heroRef} className="relative w-full bg-hero-bg" style={{ overflow: 'visible' }}>
      {/* Background image centered on mobile with vertical gradient from top, smooth fade to avoid harsh cutoff */}
      <div
        className="lg:hidden absolute inset-0"
        style={{
          backgroundImage: `url(${cube.image.uri})`,
          backgroundSize: '100% auto',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          maskImage: mobileMaskGradient,
          WebkitMaskImage: mobileMaskGradient,
        }}
      />
      {/* Background image on the right with gradient for desktop */}
      <div
        className="hidden lg:block absolute inset-0"
        style={{
          backgroundImage: `url(${cube.image.uri})`,
          backgroundSize: 'auto 200%',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          maskImage: maskGradient,
          WebkitMaskImage: maskGradient,
        }}
      />

      {/* Content */}
      <div className="relative p-4">
        {/* Cube name, card count, followers and gear icon in horizontal layout */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 flex-1">
            <div>
              <h1 className="text-white font-semibold text-4xl">{cube.name}</h1>
              <Text md className="text-white/80 mt-1">
                {getCubeCardCountSnippet(cube)} Cube •{' '}
                <FollowersModalLink
                  href="#"
                  modalprops={{ id: cube.id, type: 'cube' }}
                  className="text-white/80 hover:text-white hover:underline"
                >
                  {cube.following?.length || 0} {cube.following?.length === 1 ? 'follower' : 'followers'}
                </FollowersModalLink>
              </Text>
            </div>
            <Flexbox direction="row" gap="2" alignItems="center">
              {cube.owner.image && (
                <a href={`/user/view/${cube.owner.id}`}>
                  <img
                    className="profile-thumbnail"
                    src={cube.owner.image.uri}
                    alt={cube.owner.image.artist}
                    title={cube.owner.image.artist}
                  />
                </a>
              )}
              <Text md className="text-white">
                Designed by{' '}
                <a href={`/user/view/${cube.owner.id}`} className="text-white font-semibold hover:underline">
                  {cube.owner.username}
                </a>
              </Text>
            </Flexbox>
          </div>

          {/* Gear icon */}
          {isCubeOwner && (
            <div className="flex-shrink-0">
              <Dropdown
                trigger={
                  <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
                    <span
                      style={{
                        filter: 'drop-shadow(0 0 3px rgba(0, 0, 0, 1)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.8))',
                      }}
                    >
                      <GearIcon size={24} />
                    </span>
                  </button>
                }
                align="right"
                minWidth="16rem"
              >
                <Flexbox direction="col" gap="2" className="p-3">
                  {(cube.cardCount > 0 && (
                    <CubeOverviewModalLink
                      modalprops={{
                        cube: cube,
                      }}
                      className="!text-text hover:!text-link-active"
                    >
                      Edit Primer
                    </CubeOverviewModalLink>
                  )) || (
                    <Tooltip text="Please add at least one card to the cube in order to edit the primer. This is a spam prevention mechanism.">
                      <span className="!text-text opacity-50 cursor-not-allowed">Edit Primer</span>
                    </Tooltip>
                  )}
                  <CubeSettingsModalLink
                    modalprops={{ addAlert, onCubeUpdate: () => {} }}
                    className="!text-text hover:!text-link-active"
                  >
                    Edit Settings
                  </CubeSettingsModalLink>
                  <CustomizeBasicsModalLink
                    modalprops={{
                      cube: cube,
                      onError: (message: string) => {
                        addAlert('danger', message);
                      },
                    }}
                    className="!text-text hover:!text-link-active"
                  >
                    Customize basics
                  </CustomizeBasicsModalLink>
                  <Link
                    href={`/cube/restore/${encodeURIComponent(getCubeId(cube))}`}
                    className="!text-text hover:!text-link-active"
                  >
                    Restore
                  </Link>
                  <DeleteCubeModalLink modalprops={{ cube }} className="!text-text hover:!text-link-active">
                    Delete Cube
                  </DeleteCubeModalLink>
                  {hasCustomImages && (
                    <>
                      <div className="border-t border-border my-1"></div>
                      <Link onClick={toggleShowCustomImages} className="!text-text hover:!text-link-active">
                        {showCustomImages ? 'Hide Custom Images' : 'Show Custom Images'}
                      </Link>
                    </>
                  )}
                </Flexbox>
              </Dropdown>
            </div>
          )}
        </div>

        {/* Brief */}
        {cube.brief && (
          <div className="mb-4">
            <div className="text-white">
              <SafeMarkdown markdown={cube.brief} />
            </div>
          </div>
        )}

        {/* Tags */}
        {cube.tags && cube.tags.length > 0 && (
          <Flexbox direction="row" gap="2" wrap="wrap" className="mb-4">
            {cube.tags.map((tag, index) => (
              <a
                key={index}
                href={`/search?q=tag:"${encodeURIComponent(tag)}"`}
                className="px-3 py-1 bg-button-primary text-white text-sm rounded-full hover:bg-button-primary-active transition-colors font-medium"
              >
                {tag}
              </a>
            ))}
          </Flexbox>
        )}

        {/* Action icons */}
        <div>
          <Flexbox direction="row" gap="4" alignItems="center" wrap="wrap">
            {user && !isCubeOwner && (
              <button
                onClick={handleFollowToggle}
                className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors whitespace-nowrap"
                aria-label={followedState ? 'Unfollow cube' : 'Follow cube'}
              >
                {followedState ? <HeartFillIcon size={20} className="text-red-500" /> : <HeartIcon size={20} />}
                <Text sm className="text-white">
                  {followedState ? 'Followed' : 'Follow'}
                </Text>
              </button>
            )}
            <ShareCubeButton
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
              aria-label="Share cube"
              modalprops={{
                shortId: cube.shortId,
                fullID: cube.id,
                cubeUrl: `${baseUrl}/cube/list/${cube.id}`,
                cubeName: cube.name,
                alert: addAlert,
              }}
            >
              <LinkIcon size={20} />
              <Text sm className="text-white">
                Share
              </Text>
            </ShareCubeButton>
            <div className="flex items-center whitespace-nowrap">
              <Dropdown
                trigger={
                  <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
                    <PackageIcon size={20} />
                    <Text sm className="text-white">
                      Purchase
                    </Text>
                  </button>
                }
                align="left"
                minWidth="16rem"
              >
                {purchaseMenuItems}
              </Dropdown>
            </div>
            <div className="flex items-center whitespace-nowrap">
              <Dropdown
                trigger={
                  <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
                    <DownloadIcon size={20} />
                    <Text sm className="text-white">
                      Export
                    </Text>
                  </button>
                }
                align="left"
                minWidth="16rem"
              >
                {exportMenuItems}
              </Dropdown>
            </div>
            <CompareModalButton
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
              aria-label="Compare cubes"
            >
              <ArrowSwitchIcon size={20} />
              <Text sm className="text-white">
                Compare
              </Text>
            </CompareModalButton>
            <a
              href={`/cube/rss/${cube.id}`}
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors whitespace-nowrap"
              aria-label="RSS Feed"
            >
              <RssIcon size={20} />
              <Text sm className="text-white">
                RSS
              </Text>
            </a>
            <a
              href={`https://luckypaper.co/resources/cube-map/?cube=${cube.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors whitespace-nowrap"
              aria-label="View in Cube Map"
            >
              <GlobeIcon size={20} />
              <Text sm className="text-white">
                Cube Map
              </Text>
            </a>
            <ReportCubeButton
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
              aria-label="Report cube"
              modalprops={{
                title: 'Report Cube',
                message:
                  'Are you sure you want to report this cube? A moderator will review the report and take appropriate action.',
                target: `/cube/report/${cube.id}`,
                buttonText: 'Report Cube',
              }}
            >
              <StopIcon size={20} />
              <Text sm className="text-white">
                Report
              </Text>
            </ReportCubeButton>
          </Flexbox>
        </div>
      </div>
    </div>
  );
};

export default CubeHero;
