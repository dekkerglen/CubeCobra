/*
 * Local development harness for the Patreon webhook (POST /patreon/hook).
 *
 * It builds a Patreon-shaped webhook payload, signs it with PATREON_HOOK_SECRET exactly the
 * way Patreon does (HMAC-MD5 over the raw JSON bytes), and POSTs it to your running local
 * server. This exercises the real handler and the real (LocalStack) DynamoDB write path, so
 * it reproduces issues like the insert-only put failure that a unit test can't.
 *
 * Prereqs: local server running (`npm run dev`) and, for --seed/--show, LocalStack up.
 *
 * Usage (from packages/server):
 *   ts-node -r tsconfig-paths/register scripts/patreon-hook-dev.ts <event> <email> [tierTitle] [--seed] [--show]
 *
 * Examples:
 *   # deactivate a patron (the unsubscribe case)
 *   ts-node -r tsconfig-paths/register scripts/patreon-hook-dev.ts members:pledge:delete patron@example.com --show
 *
 *   # activate a Lotus Cobra patron (seed the record first if it doesn't exist)
 *   ts-node -r tsconfig-paths/register scripts/patreon-hook-dev.ts members:pledge:create patron@example.com "Lotus Cobra" --seed --show
 *
 *   # replay a deprecated v1 event (the queued backlog shape)
 *   ts-node -r tsconfig-paths/register scripts/patreon-hook-dev.ts pledges:delete patron@example.com
 */
import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config();

import crypto from 'crypto';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));

const [event, emailArg, tierTitle] = positional;
const email = (emailArg || '').toLowerCase();
const port = process.env.PORT || '5000';
const url = `http://localhost:${port}/patreon/hook`;
// The owner id only matters for --seed; the webhook itself keys off email.
const OWNER = process.env.PATREON_DEV_OWNER || 'dev-patron-owner';

if (!event || !email) {
  // eslint-disable-next-line no-console
  console.error(
    'Usage: patreon-hook-dev.ts <event> <email> [tierTitle] [--seed] [--show]\n' +
      'Events: members:pledge:create | members:pledge:update | members:pledge:delete |\n' +
      '        members:create | members:update | members:delete | pledges:create | pledges:update | pledges:delete',
  );
  process.exit(1);
}

const active = !event.endsWith(':delete');

// Build the payload matching the API version implied by the event name.
const buildPayload = (): any => {
  if (event.startsWith('members:')) {
    const tiers = active && tierTitle ? [{ id: 'tier-dev', type: 'tier', title: tierTitle }] : [];
    return {
      data: {
        type: 'member',
        id: 'member-dev',
        attributes: {
          email,
          patron_status: active ? 'active_patron' : 'former_patron',
          currently_entitled_amount_cents: active ? 1000 : 0,
        },
        relationships: {
          user: { data: { id: OWNER, type: 'user' } },
          currently_entitled_tiers: { data: tiers.map((t) => ({ id: t.id, type: 'tier' })) },
        },
      },
      included: [
        { type: 'user', id: OWNER, attributes: { email, full_name: 'Dev Patron' } },
        ...tiers.map((t) => ({ type: 'tier', id: t.id, attributes: { title: t.title } })),
      ],
    };
  }

  // Deprecated v1 pledge shape.
  return {
    data: {
      type: 'pledge',
      id: 'pledge-dev',
      relationships: {
        patron: { data: { id: OWNER, type: 'user' } },
        ...(active && tierTitle ? { reward: { data: { id: 'reward-dev', type: 'reward' } } } : {}),
      },
    },
    included: [
      { type: 'user', id: OWNER, attributes: { email } },
      ...(active && tierTitle ? [{ type: 'reward', id: 'reward-dev', attributes: { title: tierTitle } }] : []),
    ],
  };
};

const main = async () => {
  if (flags.has('--seed')) {
    const { patronDao } = await import('../src/dynamo/daos');
    const existing = await patronDao.getByEmail(email);
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`[seed] patron already exists for ${email} (owner ${existing.owner})`);
    } else {
      await patronDao.put({
        email,
        owner: OWNER,
        level: 0,
        status: 'i',
        dateCreated: 0,
        dateLastUpdated: 0,
      } as any);
      // eslint-disable-next-line no-console
      console.log(`[seed] inserted patron for ${email} (owner ${OWNER})`);
    }
  }

  const payload = buildPayload();
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac('md5', process.env.PATREON_HOOK_SECRET || '')
    .update(Buffer.from(rawBody))
    .digest('hex');

  // eslint-disable-next-line no-console
  console.log(`[post] ${event} -> ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-patreon-event': event,
      'x-patreon-signature': signature,
    },
    body: rawBody,
  });
  // eslint-disable-next-line no-console
  console.log(`[post] status ${res.status} body ${await res.text()}`);

  if (flags.has('--show')) {
    const { patronDao } = await import('../src/dynamo/daos');
    const patron = await patronDao.getByEmail(email);
    // eslint-disable-next-line no-console
    console.log('[show] patron after hook:', patron);
  }
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
