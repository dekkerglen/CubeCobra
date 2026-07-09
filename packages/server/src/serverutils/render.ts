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
import { getBaseUrl } from './util';

// Vite emits a manifest keyed by source path (e.g. "src/pages/DraftPage.tsx"). Each entry lists
// its own hashed `file` plus the shared chunks it `imports` (React, layout, etc.); CSS hangs off
// whichever chunk imported it. We walk that graph to gather the entry module, its shared chunks
// (for modulepreload), and all CSS for the page. Production only — dev loads modules straight
// from the Vite dev server (see main.pug).
interface ViteChunk {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}
type ViteManifest = Record<string, ViteChunk>;

// URL prefix the built assets are served under: Express serves packages/server/public, so
// /app/* maps to public/app/*. Must match `base` in packages/client/vite.config.ts.
const VITE_BASE = '/app/';

let viteManifest: ViteManifest | null = null;
const loadManifest = (): ViteManifest => {
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }
  if (!viteManifest) {
    try {
      const manifestPath = path.join(__dirname, '../../public/app/.vite/manifest.json');
      viteManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ViteManifest;
    } catch (err) {
      console.error('Failed to load Vite manifest:', (err as Error).message);
      viteManifest = {};
    }
  }
  return viteManifest || {};
};

interface PageAssets {
  entry: string | null;
  preload: string[];
  css: string[];
}

// Walk the manifest from a page entry: collect the entry module, its (recursive) static-import
// chunks for <link rel=modulepreload>, and every CSS file in the graph. cdnUrl prepends
// CDN_BASE_URL in prod so these resolve to CloudFront; same-origin otherwise.
const getPageAssets = (page: string): PageAssets => {
  const manifest = loadManifest();
  const entryKey = `src/pages/${page}.tsx`;
  const entryChunk = manifest[entryKey];
  if (!entryChunk) {
    return { entry: null, preload: [], css: [] };
  }

  const seen = new Set<string>();
  const preload = new Set<string>();
  const css = new Set<string>();

  const walk = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    (chunk.css || []).forEach((file) => css.add(file));
    (chunk.imports || []).forEach((imp) => {
      const importedChunk = manifest[imp];
      if (importedChunk) {
        preload.add(importedChunk.file);
      }
      walk(imp);
    });
  };
  walk(entryKey);

  return {
    entry: cdnUrl(VITE_BASE + entryChunk.file),
    preload: [...preload].map((file) => cdnUrl(VITE_BASE + file)),
    css: [...css].map((file) => cdnUrl(VITE_BASE + file)),
  };
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
        // In dev, main.pug loads the page entry straight from the Vite dev server (HMR); in prod it
        // uses the manifest-resolved hashed module + shared-chunk preloads + css from pageAssets.
        viteDev: process.env.NODE_ENV !== 'production',
        vitePage: page,
        viteDevOrigin: process.env.VITE_DEV_ORIGIN || 'http://localhost:5173',
        viteBase: VITE_BASE,
        pageAssets: getPageAssets(page),
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
