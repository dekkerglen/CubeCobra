/**
 * Reconcile CubeCobra patron status against a Patreon members CSV export.
 *
 * Motivation: while the Patreon webhook was failing, unsubscribe events were dropped, so
 * some patrons remain ACTIVE in our DB despite having churned. Patreon redacts the email
 * of most former patrons in the export, so we cannot find churned patrons by their CSV
 * row. Instead we reconcile against the source of truth for who *should* be active: the
 * set of "Active patron" emails. Any patron marked ACTIVE in our DB whose email is not in
 * that set has churned and should be disabled.
 *
 * This enumerates all patrons via the GSI2 `PATRON#ALL` index, so the enumeration backfill
 * (backfillPatronUserEnumerationGSI.ts) must have run first.
 *
 * Disabling mirrors the webhook's deactivate path exactly: set patron.status = INACTIVE
 * (level is preserved), and remove the PATRON role from the linked user.
 *
 * Usage (from packages/scripts), dry run by default:
 *   ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/syncPatronStatus.ts --csv=/path/to/members.csv [--apply] [--reactivate]
 *
 *   --apply       actually write the changes (otherwise dry run — prints the delta only)
 *   --reactivate  also re-activate DB patrons that are INACTIVE but Active in the CSV
 */
import { patronDao, userDao } from '@server/dynamo/daos';
import { PatronStatuses } from '@utils/datatypes/Patron';
import { UserRoles } from '@utils/datatypes/User';
import fs from 'fs';
import Papa from 'papaparse';

import 'dotenv/config';

interface CsvRow {
  Email: string;
  'Patron Status': string;
  Name: string;
}

const ACTIVE_CSV_STATUS = 'Active patron';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const csvArg = args.find((a) => a.startsWith('--csv='));
  return {
    csvPath: csvArg ? csvArg.split('=')[1] : undefined,
    apply: args.includes('--apply'),
    reactivate: args.includes('--reactivate'),
  };
};

/**
 * Loads the set of lowercased emails that are currently Active patrons in the export.
 */
const loadActiveEmails = (csvPath: string): Set<string> => {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<CsvRow>(csv, { header: true, skipEmptyLines: true });
  const active = new Set<string>();
  for (const row of parsed.data) {
    const email = (row.Email || '').trim().toLowerCase();
    if (email && (row['Patron Status'] || '').trim() === ACTIVE_CSV_STATUS) {
      active.add(email);
    }
  }
  return active;
};

/**
 * Disables a patron: status -> INACTIVE and strip the PATRON role from the user.
 * Mirrors the webhook deactivate branch (router/routes/patreon.ts).
 */
const disablePatron = async (owner: string, email: string): Promise<void> => {
  const patron = await patronDao.getByEmail(email);
  if (!patron) {
    return;
  }
  patron.status = PatronStatuses.INACTIVE; // preserve level for reporting
  await patronDao.update(patron);

  const user = await userDao.getByIdWithSensitiveData(owner);
  if (user && user.roles) {
    user.roles = user.roles.filter((role) => role !== UserRoles.PATRON);
    await userDao.update(user as any);
  }
};

/**
 * Re-activates a patron: status -> ACTIVE and ensure the PATRON role on the user.
 */
const reactivatePatron = async (owner: string, email: string): Promise<void> => {
  const patron = await patronDao.getByEmail(email);
  if (!patron) {
    return;
  }
  patron.status = PatronStatuses.ACTIVE;
  await patronDao.update(patron);

  const user = await userDao.getByIdWithSensitiveData(owner);
  if (user) {
    if (!user.roles) {
      user.roles = [UserRoles.PATRON];
    } else if (!user.roles.includes(UserRoles.PATRON)) {
      user.roles.push(UserRoles.PATRON);
    }
    await userDao.update(user as any);
  }
};

const main = async (): Promise<void> => {
  const { csvPath, apply, reactivate } = parseArgs();
  if (!csvPath) {
    throw new Error('Provide the Patreon export path via --csv=/path/to/members.csv');
  }

  const activeEmails = loadActiveEmails(csvPath);
  // eslint-disable-next-line no-console
  console.log('='.repeat(80));
  // eslint-disable-next-line no-console
  console.log(`Patron status reconciliation ${apply ? '(APPLY — writing changes)' : '(DRY RUN)'}`);
  // eslint-disable-next-line no-console
  console.log(`CSV active patrons: ${activeEmails.size}`);

  const patrons = await patronDao.listAllPatrons();
  // eslint-disable-next-line no-console
  console.log(`DB patron records: ${patrons.length}`);
  // eslint-disable-next-line no-console
  console.log('='.repeat(80));

  // ACTIVE in DB but not in the active CSV set -> churned, should be disabled.
  const toDisable = patrons.filter(
    (p) => p.status === PatronStatuses.ACTIVE && !activeEmails.has((p.email || '').toLowerCase()),
  );
  // INACTIVE in DB but Active in CSV -> re-subscribed while the webhook was down.
  const toReactivate = patrons.filter(
    (p) => p.status === PatronStatuses.INACTIVE && activeEmails.has((p.email || '').toLowerCase()),
  );

  // eslint-disable-next-line no-console
  console.log(`\nTo DISABLE (ACTIVE in DB, not an Active patron in CSV): ${toDisable.length}`);
  for (const p of toDisable) {
    // eslint-disable-next-line no-console
    console.log(`  disable  ${p.email}  (owner ${p.owner}, level ${p.level})`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nRe-subscribed (INACTIVE in DB, Active in CSV): ${toReactivate.length}${reactivate ? '' : ' [reporting only — pass --reactivate to act]'}`);
  for (const p of toReactivate) {
    // eslint-disable-next-line no-console
    console.log(`  reactivate  ${p.email}  (owner ${p.owner}, level ${p.level})`);
  }

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log(`\n*** DRY RUN — no changes written. Re-run with --apply to disable ${toDisable.length} patron(s). ***`);
    return;
  }

  let disabled = 0;
  let errors = 0;
  for (const p of toDisable) {
    try {
      await disablePatron(p.owner, (p.email || '').toLowerCase());
      disabled += 1;
    } catch (err) {
      errors += 1;
      // eslint-disable-next-line no-console
      console.error(`  ❌ failed to disable ${p.email}:`, (err as Error).message);
    }
  }

  let reactivated = 0;
  if (reactivate) {
    for (const p of toReactivate) {
      try {
        await reactivatePatron(p.owner, (p.email || '').toLowerCase());
        reactivated += 1;
      } catch (err) {
        errors += 1;
        // eslint-disable-next-line no-console
        console.error(`  ❌ failed to reactivate ${p.email}:`, (err as Error).message);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nApplied: disabled=${disabled}, reactivated=${reactivated}, errors=${errors}`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Reconciliation failed:', err);
    process.exit(1);
  });
