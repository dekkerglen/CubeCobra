import { cdnUrl } from '@utils/cdnUrl';
import CubeType from '@utils/datatypes/Cube';
import Image from '@utils/datatypes/Image';
import { NotificationStatus } from '@utils/datatypes/Notification';
import User, { UserRoles, YourCubesSortOrder } from '@utils/datatypes/User';
import fs from 'fs';
import path from 'path';
import serialize from 'serialize-javascript';

import 'dotenv/config';

import { SortOrder } from '../dynamo/dao/CubeDynamoDao';
import { collaboratorIndexDao, cubeDao, notificationDao, patronDao } from '../dynamo/daos';
import { CubeTooLargeError } from '../errors/CubeTooLargeError';
import { Request, Response } from '../types/express';
import { GIT_COMMIT } from './git';
import { getBaseUrl } from './util';

interface BundleManifest {
  [key: string]: string | { [key: string]: string } | undefined;
  css?: { [key: string]: string };
}

let bundleManifest: BundleManifest | null = null;
const loadManifest = (): BundleManifest => {
  // Only load manifest in production
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }

  if (!bundleManifest) {
    try {
      const manifestPath = path.join(__dirname, '../../public/manifest.json');
      bundleManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BundleManifest;
    } catch (err) {
      console.error('Failed to load bundle manifest, falling back to non-hashed filenames:', (err as Error).message);
      bundleManifest = {};
    }
  }
  return bundleManifest || {};
};

export const getCubesSortValues = (user: User): { sort: SortOrder; ascending: boolean } => {
  if (user.yourCubesSortOrder === YourCubesSortOrder.ALPHA) {
    return { sort: 'alphabetical', ascending: true };
  } else {
    return { sort: 'date', ascending: false };
  }
};

const trimCube = (cube: CubeType): Pick<CubeType, 'id' | 'shortId' | 'name'> => ({
  id: cube.id,
  shortId: cube.shortId,
  name: cube.name,
});

const DROPDOWN_CUBE_LIMIT = 20;

/**
 * Resolves the cubes an owner has pinned, in most-recently-pinned order.
 * Pins are private to the owner, so this returns nothing unless the viewer
 * is the owner. Callers hoist these to the top of cube listings.
 */
export const getPinnedCubesForOwner = async (
  ownerId: string,
  viewerId: string | undefined,
  limit = 200,
): Promise<{ pinnedCubes: CubeType[]; pinnedIds: Set<string> }> => {
  if (!viewerId || viewerId !== ownerId) {
    return { pinnedCubes: [], pinnedIds: new Set() };
  }

  const pinnedResult = await cubeDao.queryCubesPinnedBy(ownerId, undefined, limit);
  if (pinnedResult.cubeIds.length === 0) {
    return { pinnedCubes: [], pinnedIds: new Set() };
  }

  const fetched = await cubeDao.batchGet(pinnedResult.cubeIds);
  const byId = new Map(fetched.map((cube) => [cube.id, cube]));
  const pinnedCubes = pinnedResult.cubeIds
    .map((id) => byId.get(id))
    .filter((cube): cube is CubeType => cube !== undefined);

  return { pinnedCubes, pinnedIds: new Set(pinnedCubes.map((cube) => cube.id)) };
};

const getCubes = async (req: Request, callback: (cubes: CubeType[]) => void): Promise<void> => {
  if (!req.user) {
    callback([]);
    return;
  }

  const { sort, ascending } = getCubesSortValues(req.user);
  const userId = req.user.id;

  // Query the user's owned cubes and their pinned cubes in parallel, then merge:
  // pinned cubes first (most recently pinned), then the rest of the owned cubes,
  // deduped, capped at the dropdown limit.
  const [ownerQuery, { pinnedCubes, pinnedIds }] = await Promise.all([
    cubeDao.queryByOwner(userId, sort, ascending, undefined, DROPDOWN_CUBE_LIMIT),
    getPinnedCubesForOwner(userId, userId, DROPDOWN_CUBE_LIMIT),
  ]);

  const rest = ownerQuery.items.filter((cube) => !pinnedIds.has(cube.id));

  callback([...pinnedCubes, ...rest].slice(0, DROPDOWN_CUBE_LIMIT));
};

const redirect = (req: Request, res: Response, to: string): void => {
  if (req.session) {
    req.session.save(() => {
      res.redirect(to);
    });
  } else {
    res.redirect(to);
  }
};

const getBundlesForPage = (page: string): string[] => {
  const manifest = loadManifest();

  // Try to get hashed filenames from manifest, fall back to non-hashed.
  // cdnUrl prepends CDN_BASE_URL when set (prod with CloudFront), otherwise
  // returns the same-origin path that Express serves from public/.
  const vendors = cdnUrl((manifest['vendors'] as string) || `/js/vendors.bundle.js`);
  const commons = cdnUrl((manifest['commons'] as string) || `/js/commons.bundle.js`);
  const pageBundleName = cdnUrl((manifest[page] as string) || `/js/${page}.bundle.js`);

  return [vendors, commons, pageBundleName];
};

const CSS_BUNDLE_NAMES = ['stylesheet', 'autocomplete', 'editcube', 'tags'] as const;
type CssBundleName = (typeof CSS_BUNDLE_NAMES)[number];
type CssBundles = Record<CssBundleName, string>;

const getCssBundles = (): CssBundles => {
  const manifest = loadManifest();
  const cssMap = manifest.css || {};
  return CSS_BUNDLE_NAMES.reduce((acc, name) => {
    // In dev (no manifest), fall back to the un-hashed file with a commit
    // query string so a browser refresh after a deploy picks up changes.
    acc[name] = cdnUrl(cssMap[name] || `/css/${name}.css?v=${GIT_COMMIT}`);
    return acc;
  }, {} as CssBundles);
};

const sha256 = async (data: string): Promise<string> => {
  const buffer = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map((b) => ('00' + b.toString(16)).slice(-2)).join('');
  return hashHex;
};

interface MetadataItem {
  property: string;
  content: string;
}

interface RenderOptions {
  metadata?: MetadataItem[];
  title?: string;
  noindex?: boolean;
}

interface ReactProps {
  user?: {
    id: string;
    username: string;
    email?: string;
    about?: string;
    image?: Image;
    roles?: UserRoles[];
    // Patreon tier info, so the client can gate tier-locked features (e.g. image hosting).
    patronLevel?: number;
    patronStatus?: string;
    profileHostedImageId?: string;
    profileImageUrl?: string;
    theme?: string;
    hideFeatured?: boolean;
    hideTagColors?: boolean;
    cubes: Pick<CubeType, 'id' | 'shortId' | 'name'>[];
    collaboratingCubes?: Pick<CubeType, 'id' | 'shortId' | 'name'>[];
    notifications?: any[];
    defaultPrinting?: string;
    gridTightness?: string;
    autoBlog?: boolean;
    consentToHashedEmail?: boolean;
    email_token: string;
    yourCubesSortOrder?: YourCubesSortOrder;
    disableAnimations?: boolean;
    useTextOverIcons?: boolean;
    disableCubeTray?: boolean;
  };
  nitroPayEnabled?: boolean;
  baseUrl?: string;
  captchaSiteKey?: string;
  csrfToken?: string;
  // Git commit of the bundle that rendered this page. Baked in at page-load time, so
  // a long-open (stale) tab keeps the version it was served with — lets error reports
  // distinguish which frontend build actually threw, independent of the server version.
  version?: string;
  [key: string]: any;
}

const render = (
  req: Request,
  res: Response,
  page: string,
  reactProps: ReactProps = {},
  options: RenderOptions = {},
): void => {
  getCubes(req, async (cubes) => {
    if (req.user) {
      const [notifications, collaboratingCubeIds, patron] = await Promise.all([
        notificationDao.getByToAndStatus(req.user.id, NotificationStatus.UNREAD),
        collaboratorIndexDao.getCubeIdsForUser(req.user.id),
        // Patron level is only needed to gate optional perks. A Patron-table hiccup must not
        // take down every authenticated page render, so degrade to "no patron" on failure.
        patronDao.getById(req.user.id).catch(() => undefined),
      ]);
      const collaboratingCubes = collaboratingCubeIds.length > 0 ? await cubeDao.batchGet(collaboratingCubeIds) : [];

      reactProps.user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        about: req.user.about,
        image: req.user.image,
        roles: req.user.roles,
        patronLevel: patron?.level,
        patronStatus: patron?.status,
        // Sent so the profile form can round-trip a custom avatar without clearing it.
        profileHostedImageId: req.user.profileHostedImageId,
        profileImageUrl: req.user.profileImageUrl,
        theme: req.user.theme,
        hideFeatured: req.user.hideFeatured,
        hideTagColors: req.user.hideTagColors,
        cubes: cubes.map(trimCube),
        collaboratingCubes: collaboratingCubes.map(trimCube),
        notifications: notifications.items,
        defaultPrinting: req.user.defaultPrinting,
        gridTightness: req.user.gridTightness,
        autoBlog: req.user.autoBlog,
        consentToHashedEmail: req.user.consentToHashedEmail,
        email_token: req.user.consentToHashedEmail && req.user.email ? await sha256(req.user.email) : '',
        yourCubesSortOrder: req.user.yourCubesSortOrder,
        disableAnimations: req.user.disableAnimations,
        useTextOverIcons: req.user.useTextOverIcons,
        disableCubeTray: req.user.disableCubeTray,
      };
    }

    reactProps.nitroPayEnabled = process.env.NITROPAY_ENABLED === 'true';
    reactProps.baseUrl = getBaseUrl();
    reactProps.cdnBaseUrl = process.env.CDN_BASE_URL || '';
    reactProps.captchaSiteKey = process.env.CAPTCHA_SITE_KEY;
    reactProps.version = process.env.CUBECOBRA_VERSION;
    if (res.locals.csrfToken) {
      reactProps.csrfToken = res.locals.csrfToken;
    }

    if (!options.metadata) {
      options.metadata = [];
    }
    // Every page is an Open Graph "website" unless a route said otherwise. Beyond
    // spec correctness, some in-app browsers / link-preview scrapers inject a script
    // that reads meta[property='og:type'].content and throws when it's absent.
    if (!options.metadata.some((data) => data.property === 'og:type')) {
      options.metadata.push({ property: 'og:type', content: 'website' });
    }
    // og:image must be an absolute URL for crawlers; baseUrl + cdnUrl handles
    // both cases (CloudFront when CDN_BASE_URL is set, otherwise same-origin).
    const stickerPath = cdnUrl('/content/sticker.png');
    const fallbackImage = stickerPath.startsWith('http') ? stickerPath : `${getBaseUrl()}${stickerPath}`;
    const existingOgImage = options.metadata.find((data) => data.property === 'og:image');
    if (!existingOgImage) {
      options.metadata.push({ property: 'og:image', content: fallbackImage });
    } else if (!existingOgImage.content) {
      existingOgImage.content = fallbackImage;
    }
    // Mirror the fallback onto twitter:image so both crawlers get a usable image.
    const existingTwitterImage = options.metadata.find((data) => data.property === 'twitter:image');
    if (existingTwitterImage && !existingTwitterImage.content) {
      existingTwitterImage.content = fallbackImage;
    }

    try {
      const theme = (req && req.user && req.user.theme) || 'system';
      const disableAnimations = req && req.user && req.user.disableAnimations;
      const htmlClasses = [theme, disableAnimations && 'disable-animations'].filter(Boolean).join(' ');
      res.render('main', {
        reactHTML: null, // TODO renable ReactDOMServer.renderToString(React.createElement(page, reactProps)),
        reactProps: serialize(reactProps),
        bundles: getBundlesForPage(page),
        cssBundles: getCssBundles(),
        metadata: options.metadata,
        title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
        patron: req.user && (req.user.roles || []).includes(UserRoles.PATRON),
        notice: process.env.NOTICE,
        theme,
        htmlClasses,
        noindex: options.noindex || false,
      });
    } catch {
      res.status(500).send('Error rendering page');
    }
  });
};

const handleRouteError = function (req: Request, res: Response, err: any, reroute: string): void {
  if (err instanceof Error === false) {
    err = new Error('Unknown error');
  }

  // A too-large cube can't be rendered by ANY card-loading route, so redirecting (the
  // normal error path) bounces between them (list <-> about) into a redirect storm. Render
  // a terminal page explaining it instead, and don't log it as a server error — it's a
  // known, non-actionable condition, not a fault.
  if (err instanceof CubeTooLargeError) {
    res.status(413);
    render(
      req,
      res,
      'ErrorPage',
      {
        error: `This cube is too large to display: it has ${err.cardCount.toLocaleString()} cards, which exceeds the maximum of ${err.limit.toLocaleString()}.`,
        requestId: req.uuid,
        title: 'Cube too large',
      },
      { noindex: true },
    );
    return;
  }

  req.logger.error(err.message, err.stack);
  req.flash('danger', err.message);
  redirect(req, res, reroute);
};

export { handleRouteError, redirect, render };

export default {
  render,
  redirect,
  handleRouteError,
};
