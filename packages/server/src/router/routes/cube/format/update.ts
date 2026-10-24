import { CardSlot, DraftAction, DraftFormat, DraftStep, Pack } from '@utils/datatypes/Draft';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import sanitizeHtml from 'sanitize-html';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

// Upper bounds for a custom draft format. Formats are persisted on the cube and every pack is
// built (and can be rendered as an image) per seat, so the shape has to stay small.
export const MAX_FORMAT_TITLE_LENGTH = 200;
export const MAX_FORMAT_MARKDOWN_LENGTH = 20_000;
export const MAX_FORMAT_PACKS = 30;
export const MAX_PACK_SLOTS = 30;
export const MAX_PACK_STEPS = 4 * MAX_PACK_SLOTS;
export const MAX_SLOT_FILTER_LENGTH = 500;
const MAX_BASICS_BOARD_LENGTH = 100;

const DRAFT_ACTIONS: readonly DraftAction[] = ['pick', 'pass', 'trash', 'pickrandom', 'trashrandom', 'endpack'];

// Legacy formats carried a raw `html` description. It is only kept for formats that have no
// markdown, and only as basic formatting.
const LEGACY_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'a', 'ul', 'ol', 'li', 'h5', 'h6', 'div'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeSlot = (raw: unknown): CardSlot | null => {
  // Very old formats stored a slot as a bare filter string.
  const filter = typeof raw === 'string' ? raw : isPlainObject(raw) ? (raw.filter ?? '') : null;
  if (typeof filter !== 'string' || filter.length > MAX_SLOT_FILTER_LENGTH) {
    return null;
  }
  // The legacy `board` field is deliberately dropped: the editor migrates it into the filter
  // string on load, so createdraft.ts only ever sees the filter (see compileSlotFilter).
  return { filter };
};

const sanitizeStep = (raw: unknown): DraftStep | null => {
  if (!isPlainObject(raw) || !DRAFT_ACTIONS.includes(raw.action as DraftAction)) {
    return null;
  }
  const { amount } = raw;
  if (amount !== null && amount !== undefined) {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > MAX_PACK_SLOTS) {
      return null;
    }
  }
  return { action: raw.action as DraftAction, amount: (amount as number | null | undefined) ?? null };
};

/**
 * Rebuilds a custom draft format from untrusted input, keeping only known fields with sane
 * types and sizes. Returns a user-facing error when the format can't be accepted.
 */
export const sanitizeDraftFormat = (raw: unknown): { format?: DraftFormat; error?: string } => {
  if (!isPlainObject(raw)) {
    return { error: 'Invalid format data.' };
  }

  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_FORMAT_TITLE_LENGTH) : '';
  if (!title) {
    return { error: 'Each format must have a title' };
  }

  if (!Array.isArray(raw.packs) || raw.packs.length === 0) {
    return { error: `Format "${title}" must have at least one pack` };
  }
  if (raw.packs.length > MAX_FORMAT_PACKS) {
    return { error: `Format "${title}" can have at most ${MAX_FORMAT_PACKS} packs` };
  }

  const packs: Pack[] = [];
  for (const [packIndex, rawPack] of raw.packs.entries()) {
    const label = `Pack ${packIndex + 1} of format "${title}"`;
    if (!isPlainObject(rawPack) || !Array.isArray(rawPack.slots)) {
      return { error: `${label} is invalid` };
    }
    if (rawPack.slots.length > MAX_PACK_SLOTS) {
      return { error: `${label} can have at most ${MAX_PACK_SLOTS} cards` };
    }

    const slots: CardSlot[] = [];
    for (const rawSlot of rawPack.slots) {
      const slot = sanitizeSlot(rawSlot);
      if (!slot) {
        return { error: `${label} has a card slot that is invalid or whose filter is too long` };
      }
      slots.push(slot);
    }

    let steps: DraftStep[] | null = null;
    if (rawPack.steps !== null && rawPack.steps !== undefined) {
      if (!Array.isArray(rawPack.steps) || rawPack.steps.length > MAX_PACK_STEPS) {
        return { error: `${label} has invalid draft steps` };
      }
      steps = [];
      for (const rawStep of rawPack.steps) {
        const step = sanitizeStep(rawStep);
        if (!step) {
          return { error: `${label} has an invalid draft step` };
        }
        steps.push(step);
      }
    }

    const pack: Pack = { slots, steps };
    if (rawPack.randomizeOrder === true) {
      pack.randomizeOrder = true;
    }
    packs.push(pack);
  }

  const seats = Number.parseInt(String(raw.defaultSeats), 10);
  const format: DraftFormat = {
    title,
    packs,
    multiples: raw.multiples === true || raw.multiples === 'true',
    defaultSeats: Number.isInteger(seats) ? Math.min(Math.max(seats, 2), 16) : 8,
  };

  if (typeof raw.markdown === 'string' && raw.markdown) {
    format.markdown = raw.markdown.slice(0, MAX_FORMAT_MARKDOWN_LENGTH);
  } else if (typeof raw.html === 'string' && raw.html.trim()) {
    const html = sanitizeHtml(raw.html.slice(0, MAX_FORMAT_MARKDOWN_LENGTH), LEGACY_HTML_OPTIONS);
    if (html.trim()) {
      format.html = html;
    }
  }

  if (typeof raw.basicsBoard === 'string') {
    format.basicsBoard = raw.basicsBoard.slice(0, MAX_BASICS_BOARD_LENGTH);
  }

  return { format };
};

export const updateDraftFormatsHandler = async (req: Request, res: Response) => {
  try {
    // Parse JSON from form fields
    const formatsJson = req.body.formats;
    const enableDraft = req.body.enableDraft === 'true';
    const enableMultiplayer = req.body.enableMultiplayer === 'true';
    const enableSealed = req.body.enableSealed === 'true';
    const enableGrid = req.body.enableGrid === 'true';
    const basicsBoard = req.body.basicsBoard || 'None';
    const defaultFormat = parseInt(req.body.defaultFormat ?? '-1', 10);
    const deckbuildSpells = parseInt(req.body.deckbuildSpells ?? '23', 10);
    const deckbuildLands = parseInt(req.body.deckbuildLands ?? '17', 10);
    const defaultDraftSeats = parseInt(req.body.defaultDraftSeats ?? '8', 10);

    let rawFormats: unknown;

    try {
      rawFormats = JSON.parse(formatsJson);
    } catch (_err) {
      req.flash('danger', 'Invalid data format');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
    }

    // Validate formats
    if (!Array.isArray(rawFormats)) {
      req.flash('danger', 'Invalid formats data');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
    }

    // Rebuild every format from a whitelist so unknown keys (such as a raw `html` payload) can
    // never be persisted and pack shapes stay bounded.
    const formats: DraftFormat[] = [];
    for (const rawFormat of rawFormats) {
      const { format, error } = sanitizeDraftFormat(rawFormat);
      if (!format) {
        req.flash('danger', error || 'Invalid formats data');
        return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
      }
      formats.push(format);
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (!cube || !isCubeEditable(cube, req.user)) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
    }

    // Update cube with new formats
    cube.formats = formats;

    // Update standard draft format toggles (stored as disable flags)
    cube.disableDraft = !enableDraft;
    cube.disableMultiplayer = !enableMultiplayer;
    cube.disableSealed = !enableSealed;
    cube.disableGrid = !enableGrid;
    cube.basicsBoard = basicsBoard;
    cube.deckbuildSpells = deckbuildSpells;
    cube.deckbuildLands = deckbuildLands;
    cube.defaultDraftSeats = defaultDraftSeats >= 2 && defaultDraftSeats <= 16 ? defaultDraftSeats : 8;

    // Validate defaultFormat is in range
    const defaultFormatInRange = defaultFormat >= -1 && defaultFormat < formats.length ? defaultFormat : -1;

    /* A cube that turned standard draft off cannot default to it, or the playtest page would
     * hide the very tile the default points at. Fall back to the first custom format; a cube
     * with no custom formats keeps standard draft since there is nothing else to pick.
     */
    cube.defaultFormat = defaultFormatInRange === -1 && !enableDraft && formats.length > 0 ? 0 : defaultFormatInRange;

    await cubeDao.update(cube);

    req.flash('success', 'Draft formats updated successfully.');
    return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
  } catch (err) {
    req.logger.error('Error updating draft formats:', err);
    req.flash('danger', 'Error updating draft formats: ' + (err as Error).message);
    return redirect(req, res, `/cube/settings/${req.params.id}?view=draft-formats`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateDraftFormatsHandler],
  },
];
