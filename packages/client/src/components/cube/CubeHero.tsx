import React, { useContext, useMemo } from 'react';
import { useState } from 'react';

import {
  ArrowSwitchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  GlobeIcon,
  HeartFillIcon,
  HeartIcon,
  KebabHorizontalIcon,
  LinkIcon,
  PackageIcon,
  QuestionIcon,
  RssIcon,
  StopIcon,
} from '@primer/octicons-react';
import { cardIsToken, cardName, cardPrice, cardPriceCardKingdom, cardPriceManaPool } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import { getCubeCardCountSnippet } from '@utils/Util';

import BaseUrlContext from '../../contexts/BaseUrlContext';
import { CSRFContext } from '../../contexts/CSRFContext';
import CubeContext from '../../contexts/CubeContext';
import DisplayContext from '../../contexts/DisplayContext';
import FilterContext from '../../contexts/FilterContext';
import UserContext from '../../contexts/UserContext';
import useAlerts from '../../hooks/UseAlerts';
import useLocalStorage from '../../hooks/useLocalStorage';
import { cardKingdomBulkLink, getBulkManaPoolLink, tcgMassEntryUrl, tcgplayerAffiliate } from '../../utils/Affiliate';
import Checkbox from '../base/Checkbox';
import Container from '../base/Container';
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
import FollowersModal from '../modals/FollowersModal';
import withModal from '../WithModal';

const ArenaExportModalItem = withModal('button', ArenaExportModal);
const CompareModalButton = withModal('button', CubeCompareModal);
const ShareCubeButton = withModal('button', CubeIdModal);
const ReportCubeButton = withModal(Link, ConfirmActionModal);
const FollowersModalLink = withModal(Link, FollowersModal);

interface CubeHeroProps {
  cube: Cube;
  minified?: boolean;
  activeLink?: string;
}

const CubeHero: React.FC<CubeHeroProps> = ({ cube, minified = false, activeLink = 'list' }) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const baseUrl = useContext(BaseUrlContext);
  const { addAlert } = useAlerts();
  const isCubeOwner = !!user && cube.owner.id === user.id;

  // Get current filter and sort values from contexts
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary } = useContext(CubeContext);
  const { filterInput } = useContext(FilterContext);

  // State for collapsed hero, stored per page
  const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(`cube-hero-collapsed-${activeLink}`, false);
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
  const moreMenuRef = React.useRef<HTMLDivElement>(null);
  const [moreMenuAlign, setMoreMenuAlign] = React.useState<'left' | 'right'>('left');

  const { showCustomImages: _showCustomImages, toggleShowCustomImages: _toggleShowCustomImages } =
    useContext(DisplayContext);

  const { hasCustomImages: _hasCustomImages, unfilteredChangedCards } = useContext(CubeContext);

  // Update More menu alignment based on position
  React.useEffect(() => {
    const updateMoreMenuAlign = () => {
      if (moreMenuRef.current) {
        const rect = moreMenuRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const screenCenterX = window.innerWidth / 2;
        setMoreMenuAlign(centerX > screenCenterX ? 'right' : 'left');
      }
    };

    updateMoreMenuAlign();
    window.addEventListener('resize', updateMoreMenuAlign);
    return () => window.removeEventListener('resize', updateMoreMenuAlign);
  }, []);

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
        // Desktop gradient: 70% image opacity at right edge, fading to 0% at halfway point (50%)
        const desktopGradient = `linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)`;
        setMaskGradient(desktopGradient);

        // Same gradient for minified hero
        setMinifiedMaskGradient(desktopGradient);

        // Mobile gradient calculation (vertical)
        // Start with medium green at top (50% image opacity), smoothly transition to full green at bottom (0% image opacity)
        const mobileGradient = `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)`;
        setMobileMaskGradient(mobileGradient);
        setMinifiedMobileMaskGradient(mobileGradient); // Same for minified on mobile
      };

      img.src = cube.image.uri;
    };

    updateGradient();
    window.addEventListener('resize', updateGradient);

    return () => window.removeEventListener('resize', updateGradient);
  }, [cube.image.uri]);

  // Determine if we should show the minified or full hero
  // If minified by default but user expanded (isCollapsed = false when minified), show full
  // If full by default but user collapsed (isCollapsed = true when not minified), show minified
  const shouldShowMinified = minified ? isCollapsed : !isCollapsed;

  // Build URL segment for export links with filter and sort parameters
  const urlSegment = useMemo(() => {
    const params = new URLSearchParams();

    if (isFilterUsed && filterInput) {
      params.set('filter', filterInput);
    }

    if (isSortUsed) {
      if (sortPrimary) params.set('primary', sortPrimary);
      if (sortSecondary) params.set('secondary', sortSecondary);
      if (sortTertiary) params.set('tertiary', sortTertiary);
      if (sortQuaternary) params.set('quaternary', sortQuaternary);
    }

    return params.toString();
  }, [isFilterUsed, filterInput, isSortUsed, sortPrimary, sortSecondary, sortTertiary, sortQuaternary]);

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
          <QuestionIcon size={16} className="hidden md:inline" />
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
          <QuestionIcon size={16} className="hidden md:inline" />
        </Tooltip>
      </Flexbox>
    </Flexbox>
  );

  const purchaseMenuItems = (
    <Flexbox direction="col" gap="2" className="p-3">
      <Text xs semibold className="text-muted uppercase px-1">
        Purchase Entire Cube
      </Text>
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
      <div className="border-t border-border my-1" />
      <Text xs semibold className="text-muted uppercase px-1">
        Purchase Unowned Cards Only
      </Text>
      {(() => {
        const unownedCards = unfilteredChangedCards.mainboard.filter(
          (card) => !card.status || card.status === 'Not Owned',
        );
        if (unownedCards.length === 0) {
          return (
            <Text xs className="text-muted px-1">
              All cards are marked as owned
            </Text>
          );
        }
        return (
          <>
            <a
              href={getBulkManaPoolLink(unownedCards)}
              target="_blank"
              rel="noopener noreferrer"
              className="!text-text hover:!text-link-active font-medium flex justify-between w-full"
            >
              <span>Mana Pool</span>
              {(() => {
                const price = unownedCards.reduce((acc, card) => acc + (cardPriceManaPool(card) ?? 0), 0);
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
                c: unownedCards
                  .map(getEntry)
                  .filter((x): x is string => x !== null)
                  .join('||'),
                affiliateurl: tcgplayerAffiliate,
              };
              const price = unownedCards.reduce((acc, card) => acc + (cardPrice(card) ?? 0), 0);
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
                c: unownedCards
                  .map(getEntry)
                  .filter((x): x is string => x !== null)
                  .join('||'),
              };
              const price = unownedCards.reduce((acc, card) => acc + (cardPriceCardKingdom(card) ?? 0), 0);
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
          </>
        );
      })()}
    </Flexbox>
  );

  // Render minified hero if needed
  if (shouldShowMinified) {
    return (
      <div className="relative w-full bg-hero-bg md:border-b border-border" style={{ overflow: 'visible' }}>
        {/* Background image on mobile with triple zoom */}
        <div
          className="md:hidden absolute inset-0"
          style={{
            backgroundImage: `url(${cube.image.uri})`,
            backgroundSize: 'cover',
            backgroundPosition: 'top center',
            backgroundRepeat: 'no-repeat',
            maskImage: minifiedMobileMaskGradient,
            WebkitMaskImage: minifiedMobileMaskGradient,
          }}
        />
        {/* Background image on desktop with triple zoom */}
        <div
          className="hidden md:block absolute inset-0"
          style={{
            backgroundImage: `url(${cube.image.uri})`,
            backgroundSize: '50% auto',
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
            maskImage: minifiedMaskGradient,
            WebkitMaskImage: minifiedMaskGradient,
          }}
        />
        <div className="relative px-2 py-1">
          <div className="flex gap-2">
            {/* Main content area */}
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex flex-row items-baseline gap-2 flex-wrap mb-2">
                <h1 className="text-white font-semibold text-xl">{cube.name}</h1>
                <Text sm className="text-white/80">
                  {getCubeCardCountSnippet(cube)} Cube
                </Text>
                <Text sm className="text-white/80">
                  •
                </Text>
                <Text sm className="text-white/80">
                  by{' '}
                  <a href={`/user/view/${cube.owner.id}`} className="text-white hover:underline">
                    {cube.owner.username}
                  </a>
                </Text>
              </div>

              {/* Action icons row */}
              <div>
                {/* Desktop: All items in flex row with wrap */}
                <Flexbox direction="row" gap="4" alignItems="center" wrap="wrap" className="hidden md:flex">
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

                {/* Mobile: Purchase, Export, Compare, More with justify-between */}
                <Flexbox direction="row" justify="between" alignItems="center" className="md:hidden w-full">
                  {user && !isCubeOwner && (
                    <button
                      onClick={handleFollowToggle}
                      className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors whitespace-nowrap"
                      aria-label={followedState ? 'Unfollow cube' : 'Follow cube'}
                    >
                      {followedState ? <HeartFillIcon size={20} className="text-red-500" /> : <HeartIcon size={20} />}
                      <Text xs className="text-white">
                        {followedState ? 'Followed' : 'Follow'}
                      </Text>
                    </button>
                  )}
                  <div className="flex items-center whitespace-nowrap">
                    <Dropdown
                      trigger={
                        <button className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors">
                          <PackageIcon size={20} />
                          <Text xs className="text-white">
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
                        <button className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors">
                          <DownloadIcon size={20} />
                          <Text xs className="text-white">
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
                    className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
                    aria-label="Compare cubes"
                  >
                    <ArrowSwitchIcon size={20} />
                    <Text xs className="text-white">
                      Compare
                    </Text>
                  </CompareModalButton>
                  <div ref={moreMenuRef} className="flex items-center whitespace-nowrap">
                    <Dropdown
                      trigger={
                        <button className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors">
                          <KebabHorizontalIcon size={20} />
                          <Text xs className="text-white">
                            More
                          </Text>
                        </button>
                      }
                      align={moreMenuAlign}
                      minWidth="16rem"
                    >
                      <Flexbox direction="col" gap="2" className="p-3">
                        <ShareCubeButton
                          className="!text-text hover:!text-link-active hover:cursor-pointer font-medium text-left"
                          aria-label="Share cube"
                          modalprops={{
                            shortId: cube.shortId,
                            fullID: cube.id,
                            cubeUrl: `${baseUrl}/cube/list/${cube.id}`,
                            cubeName: cube.name,
                            alert: addAlert,
                          }}
                        >
                          <Flexbox direction="row" gap="2" alignItems="center">
                            <LinkIcon size={16} />
                            Share
                          </Flexbox>
                        </ShareCubeButton>
                        <a
                          href={`/cube/rss/${cube.id}`}
                          className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
                          aria-label="RSS Feed"
                        >
                          <Flexbox direction="row" gap="2" alignItems="center">
                            <RssIcon size={16} />
                            RSS
                          </Flexbox>
                        </a>
                        <a
                          href={`https://luckypaper.co/resources/cube-map/?cube=${cube.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
                          aria-label="View in Cube Map"
                        >
                          <Flexbox direction="row" gap="2" alignItems="center">
                            <GlobeIcon size={16} />
                            Cube Map
                          </Flexbox>
                        </a>
                        <ReportCubeButton
                          className="!text-text hover:!text-link-active hover:cursor-pointer font-medium text-left"
                          aria-label="Report cube"
                          modalprops={{
                            title: 'Report Cube',
                            message:
                              'Are you sure you want to report this cube? A moderator will review the report and take appropriate action.',
                            target: `/cube/report/${cube.id}`,
                            buttonText: 'Report Cube',
                          }}
                        >
                          <Flexbox direction="row" gap="2" alignItems="center">
                            <StopIcon size={16} />
                            Report
                          </Flexbox>
                        </ReportCubeButton>
                      </Flexbox>
                    </Dropdown>
                  </div>
                </Flexbox>
              </div>
            </div>

            {/* Icon column on the right */}
            <div className="flex flex-col gap-1">
              {/* Chevron control */}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 rounded-full bg-bg-secondary/80 hover:bg-bg-active transition-colors backdrop-blur-sm flex items-center justify-center"
                style={{ width: '32px', height: '32px' }}
                aria-label="Expand cube hero"
              >
                <ChevronDownIcon size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={heroRef} className="relative w-full bg-hero-bg" style={{ overflow: 'visible' }}>
      {/* Background image centered on mobile with vertical gradient from top, smooth fade to avoid harsh cutoff */}
      <div
        className="md:hidden absolute inset-0"
        style={{
          backgroundImage: `url(${cube.image.uri})`,
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          maskImage: mobileMaskGradient,
          WebkitMaskImage: mobileMaskGradient,
          minHeight: '100%',
        }}
      />
      {/* Background image on the right with gradient for desktop */}
      <div
        className="hidden md:block absolute inset-0"
        style={{
          backgroundImage: `url(${cube.image.uri})`,
          backgroundSize: '50% auto',
          backgroundPosition: 'right top',
          backgroundRepeat: 'no-repeat',
          maskImage: maskGradient,
          WebkitMaskImage: maskGradient,
        }}
      />

      {/* Content */}
      <div className="relative p-4">
        <>
          {/* Flex container for thumbnail and content on lg+ - wraps everything except action icons */}
          <div className="lg:flex lg:gap-4 mb-4">
            {/* Cube image thumbnail - only visible on lg and up */}
            <div className="hidden lg:block flex-shrink-0" style={{ width: 'auto', maxWidth: 'min(25%, 300px)' }}>
              <div className="relative">
                <img
                  src={cube.image.uri}
                  alt={`Art by ${cube.image.artist}`}
                  className="w-full rounded-lg shadow-lg"
                  style={{ maxHeight: '400px', objectFit: 'cover', display: 'block' }}
                />
                <em className="text-sm absolute bottom-2 right-2 text-white text-shadow">Art by {cube.image.artist}</em>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 min-w-0">
              {/* Cube name, card count, followers */}
              <div className="mb-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div>
                    <h1 className="text-white font-semibold text-3xl">{cube.name}</h1>
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
              </div>

              {/* Category badges */}
              {(cube.categoryOverride || (cube.categoryPrefixes && cube.categoryPrefixes.length > 0)) && (
                <Flexbox direction="row" gap="2" wrap="wrap" className="mb-4">
                  {cube.categoryPrefixes &&
                    cube.categoryPrefixes.map((prefix, index) => (
                      <a
                        key={`prefix-${index}`}
                        href={`/search?q=category:"${encodeURIComponent(prefix)}"`}
                        className="px-3 py-1 bg-category-badge-bg hover:bg-category-badge-bg/80 text-category-badge-text text-sm rounded-full transition-colors font-medium"
                      >
                        {prefix}
                      </a>
                    ))}
                  {cube.categoryOverride && (
                    <a
                      href={`/search?q=category:"${encodeURIComponent(cube.categoryOverride)}"`}
                      className="px-3 py-1 bg-category-badge-bg hover:bg-category-badge-bg/80 text-category-badge-text text-sm rounded-full transition-colors font-medium"
                    >
                      {cube.categoryOverride}
                    </a>
                  )}
                </Flexbox>
              )}

              {/* Brief */}
              {cube.brief && (
                <Container lg disableCenter className="mb-4">
                  <div className="text-white">
                    <SafeMarkdown markdown={cube.brief} />
                  </div>
                </Container>
              )}
            </div>
          </div>

          {/* Action icons */}
          <div>
            {/* Desktop: All items in flex row with wrap */}
            <Flexbox direction="row" gap="4" alignItems="center" wrap="wrap" className="hidden md:flex">
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

            {/* Mobile: Purchase, Export, Compare, More with justify-between */}
            <Flexbox direction="row" justify="between" alignItems="center" className="md:hidden w-full">
              {user && !isCubeOwner && (
                <button
                  onClick={handleFollowToggle}
                  className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors whitespace-nowrap"
                  aria-label={followedState ? 'Unfollow cube' : 'Follow cube'}
                >
                  {followedState ? <HeartFillIcon size={20} className="text-red-500" /> : <HeartIcon size={20} />}
                  <Text xs className="text-white">
                    {followedState ? 'Followed' : 'Follow'}
                  </Text>
                </button>
              )}
              <div className="flex items-center whitespace-nowrap">
                <Dropdown
                  trigger={
                    <button className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors">
                      <PackageIcon size={20} />
                      <Text xs className="text-white">
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
                    <button className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors">
                      <DownloadIcon size={20} />
                      <Text xs className="text-white">
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
                className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap"
                aria-label="Compare cubes"
              >
                <ArrowSwitchIcon size={20} />
                <Text xs className="text-white">
                  Compare
                </Text>
              </CompareModalButton>
              <div ref={moreMenuRef} className="flex items-center whitespace-nowrap">
                <Dropdown
                  trigger={
                    <button className="flex items-center gap-1 text-white hover:text-gray-300 transition-colors">
                      <KebabHorizontalIcon size={20} />
                      <Text xs className="text-white">
                        More
                      </Text>
                    </button>
                  }
                  align={moreMenuAlign}
                  minWidth="16rem"
                >
                  <Flexbox direction="col" gap="2" className="p-3">
                    <ShareCubeButton
                      className="!text-text hover:!text-link-active hover:cursor-pointer font-medium text-left"
                      aria-label="Share cube"
                      modalprops={{
                        shortId: cube.shortId,
                        fullID: cube.id,
                        cubeUrl: `${baseUrl}/cube/list/${cube.id}`,
                        cubeName: cube.name,
                        alert: addAlert,
                      }}
                    >
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <LinkIcon size={16} />
                        Share
                      </Flexbox>
                    </ShareCubeButton>
                    <a
                      href={`/cube/rss/${cube.id}`}
                      className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
                      aria-label="RSS Feed"
                    >
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <RssIcon size={16} />
                        RSS
                      </Flexbox>
                    </a>
                    <a
                      href={`https://luckypaper.co/resources/cube-map/?cube=${cube.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
                      aria-label="View in Cube Map"
                    >
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <GlobeIcon size={16} />
                        Cube Map
                      </Flexbox>
                    </a>
                    <ReportCubeButton
                      className="!text-text hover:!text-link-active hover:cursor-pointer font-medium text-left"
                      aria-label="Report cube"
                      modalprops={{
                        title: 'Report Cube',
                        message:
                          'Are you sure you want to report this cube? A moderator will review the report and take appropriate action.',
                        target: `/cube/report/${cube.id}`,
                        buttonText: 'Report Cube',
                      }}
                    >
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <StopIcon size={16} />
                        Report
                      </Flexbox>
                    </ReportCubeButton>
                  </Flexbox>
                </Dropdown>
              </div>
            </Flexbox>
          </div>
        </>

        {/* Chevron icon at top right */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {/* Chevron control */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-full bg-bg-secondary/80 hover:bg-bg-active transition-colors backdrop-blur-sm flex items-center justify-center"
            style={{ width: '40px', height: '40px' }}
            aria-label="Collapse cube hero"
          >
            <ChevronUpIcon size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CubeHero;
