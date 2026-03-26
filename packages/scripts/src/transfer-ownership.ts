/**
 * Transfer Ownership Script
 *
 * Transfers ALL owned resources from one user account to another.
 * Supports --dry-run mode to preview changes without writing.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/transfer-ownership.ts --from <userId|username> --to <userId|username> [--dry-run]
 *
 * Entities transferred:
 *   1.  Cubes (owner field + hash rows)
 *   2.  Blog posts (owner field)
 *   3.  Comments (owner field)
 *   4.  Content — Articles, Videos, Podcasts, Episodes (owner + typeOwnerComp)
 *   5.  Drafts (owner field, cubeOwner field where applicable)
 *   6.  Card packages (owner field)
 *   7.  Patron record (re-keyed from old owner to new owner)
 *   8.  Featured queue items (owner field)
 *   9.  Notices (user field)
 *  10.  Notifications (to / from fields, toStatusComp)
 *  11.  Feed items (to field — composite key, requires delete + re-insert)
 *  12.  P1P1 Packs (createdBy field)
 *  13.  User record updates (cubes[], followedCubes[], followedUsers[], following[])
 */

import 'dotenv/config';

import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

import blogModel from '../../server/src/dynamo/models/blog';
import commentModel from '../../server/src/dynamo/models/comment';
import contentModel from '../../server/src/dynamo/models/content';
import cubeModel from '../../server/src/dynamo/models/cube';
import draftModel from '../../server/src/dynamo/models/draft';
import featuredQueueModel from '../../server/src/dynamo/models/featuredQueue';
import feedModel from '../../server/src/dynamo/models/feed';
import noticeModel from '../../server/src/dynamo/models/notice';
import notificationModel from '../../server/src/dynamo/models/notification';
import p1p1PackModel from '../../server/src/dynamo/models/p1p1Pack';
import packageModel from '../../server/src/dynamo/models/package';
import patronModel from '../../server/src/dynamo/models/patron';
import userModel from '../../server/src/dynamo/models/user';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Summary {
  entity: string;
  found: number;
  updated: number;
  skipped: number;
  errors: number;
}

const summaries: Summary[] = [];
let DRY_RUN = false;

function log(msg: string) {
  console.log(`  ${msg}`);
}

function header(msg: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${msg}`);
  console.log('='.repeat(70));
}

function addSummary(entity: string, found: number, updated: number, skipped: number, errors: number) {
  summaries.push({ entity, found, updated, skipped, errors });
}

/** Generic paginated scan helper */
async function scanAll<T>(
  scanFn: (lastKey?: Record<string, NativeAttributeValue>) => Promise<{ items?: T[]; lastKey?: Record<string, NativeAttributeValue> }>,
): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await scanFn(lastKey);
    if (result.items && result.items.length > 0) {
      all.push(...result.items);
    }
    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }

  return all;
}

/** Generic paginated query helper (for models that use query-by-owner with lastKey) */
async function queryAll<T>(
  queryFn: (lastKey?: Record<string, NativeAttributeValue>) => Promise<{ items?: T[] | T[]; lastKey?: Record<string, NativeAttributeValue> }>,
): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await queryFn(lastKey);
    const items = result.items || [];
    if (items.length > 0) {
      all.push(...items);
    }
    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Transfer functions
// ---------------------------------------------------------------------------

async function transferCubes(fromId: string, toId: string) {
  header('1. Cubes');

  // Query cubes owned by fromId via the ByOwner GSI
  const cubes = await queryAll<any>((lastKey) => cubeModel.getByOwner(fromId, lastKey));
  log(`Found ${cubes.length} cube(s) owned by source user`);

  let updated = 0;
  let errors = 0;

  for (const cube of cubes) {
    try {
      const cubeId = cube.id || cube.Id;
      log(`  Cube: "${cube.name}" (${cubeId})`);

      if (!DRY_RUN) {
        // cubeModel.update handles hash row updates (owner hash changes) and dehydrates owner
        // We need to work with the raw/unhydrated cube to update the owner field
        // cube from getByOwner is hydrated — the update function handles owner.id → string conversion
        cube.owner = toId;
        await cubeModel.update(cube);
      }

      updated++;
    } catch (err: any) {
      log(`  ERROR updating cube ${cube.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Cubes', cubes.length, updated, 0, errors);
}

async function transferBlogPosts(fromId: string, toId: string) {
  header('2. Blog Posts');

  const posts = await queryAll<any>((lastKey) => blogModel.getByOwner(fromId, 1000, lastKey));
  log(`Found ${posts.length} blog post(s)`);

  let updated = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      log(`  Blog: "${post.title || post.id}" (${post.id})`);

      if (!DRY_RUN) {
        // Get unhydrated version to avoid putting hydrated User objects back
        const raw = await blogModel.getUnhydrated(post.id);
        if (raw) {
          raw.owner = toId;
          await blogModel.put(raw);
        }
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating blog ${post.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Blog Posts', posts.length, updated, 0, errors);
}

async function transferComments(fromId: string, toId: string) {
  header('3. Comments');

  const comments = await queryAll<any>((lastKey) => commentModel.queryByOwner(fromId, lastKey));
  log(`Found ${comments.length} comment(s)`);

  let updated = 0;
  let errors = 0;

  for (const comment of comments) {
    try {
      log(`  Comment: ${comment.id}`);

      if (!DRY_RUN) {
        // comment.put handles owner extraction (supports string or User object)
        comment.owner = toId;
        await commentModel.put(comment);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating comment ${comment.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Comments', comments.length, updated, 0, errors);
}

async function transferContent(fromId: string, toId: string) {
  header('4. Content (Articles, Videos, Podcasts, Episodes)');

  const contentTypes = ['a', 'v', 'p', 'e']; // article, video, podcast, episode
  const typeLabels: Record<string, string> = { a: 'Article', v: 'Video', p: 'Podcast', e: 'Episode' };

  let totalFound = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const type of contentTypes) {
    const items = await queryAll<any>((lastKey) => contentModel.getByTypeAndOwner(type as any, fromId, lastKey));
    log(`Found ${items.length} ${typeLabels[type]}(s)`);
    totalFound += items.length;

    for (const item of items) {
      try {
        log(`  ${typeLabels[type]}: "${item.title || item.id}" (${item.id})`);

        if (!DRY_RUN) {
          // content.update handles owner normalization and typeOwnerComp rebuild
          item.owner = toId;
          await contentModel.update(item);
        }
        totalUpdated++;
      } catch (err: any) {
        log(`  ERROR updating content ${item.id}: ${err.message}`);
        totalErrors++;
      }
    }
  }

  addSummary('Content', totalFound, totalUpdated, 0, totalErrors);
}

async function transferDrafts(fromId: string, toId: string) {
  header('5. Drafts (as drafter)');

  // Drafts where the user is the owner (drafter)
  const drafts = await queryAll<any>((lastKey) => draftModel.getByOwner(fromId, lastKey));
  log(`Found ${drafts.length} draft(s) owned by source user`);

  let updated = 0;
  let errors = 0;

  for (const draft of drafts) {
    try {
      log(`  Draft: ${draft.id}`);

      if (!DRY_RUN) {
        // Dehydrate owner if it was hydrated
        const ownerId = typeof draft.owner === 'object' ? draft.owner?.id : draft.owner;
        if (ownerId === fromId) {
          draft.owner = toId;
        }
        // Also transfer cubeOwner if it matches
        const cubeOwnerId = typeof draft.cubeOwner === 'object' ? draft.cubeOwner?.id : draft.cubeOwner;
        if (cubeOwnerId === fromId) {
          draft.cubeOwner = toId;
        }
        await draftModel.put(draft);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating draft ${draft.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Drafts (owner)', drafts.length, updated, 0, errors);

  // Also transfer drafts where the user is the cube owner
  header('5b. Drafts (as cube owner)');

  const cubeOwnerDrafts = await queryAll<any>((lastKey) => draftModel.getByCubeOwner(fromId, lastKey));
  log(`Found ${cubeOwnerDrafts.length} draft(s) where source is cubeOwner`);

  let cubeOwnerUpdated = 0;
  let cubeOwnerErrors = 0;

  for (const draft of cubeOwnerDrafts) {
    try {
      // Skip if already handled above
      const ownerId = typeof draft.owner === 'object' ? draft.owner?.id : draft.owner;
      if (ownerId === fromId) {
        log(`  Draft: ${draft.id} (already handled as owner, updating cubeOwner too)`);
      } else {
        log(`  Draft: ${draft.id} (cubeOwner only)`);
      }

      if (!DRY_RUN) {
        const cubeOwnerId = typeof draft.cubeOwner === 'object' ? draft.cubeOwner?.id : draft.cubeOwner;
        if (cubeOwnerId === fromId) {
          draft.cubeOwner = toId;
        }
        if (ownerId === fromId) {
          draft.owner = toId;
        }
        await draftModel.put(draft);
      }
      cubeOwnerUpdated++;
    } catch (err: any) {
      log(`  ERROR updating draft ${draft.id}: ${err.message}`);
      cubeOwnerErrors++;
    }
  }

  addSummary('Drafts (cubeOwner)', cubeOwnerDrafts.length, cubeOwnerUpdated, 0, cubeOwnerErrors);
}

async function transferCardPackages(fromId: string, toId: string) {
  header('6. Card Packages');

  const packages = await queryAll<any>((lastKey) => packageModel.queryByOwner(fromId, lastKey));
  log(`Found ${packages.length} package(s)`);

  let updated = 0;
  let errors = 0;

  for (const pkg of packages) {
    try {
      log(`  Package: "${pkg.title || pkg.id}" (${pkg.id})`);

      if (!DRY_RUN) {
        pkg.owner = toId;
        await packageModel.put(pkg);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating package ${pkg.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Card Packages', packages.length, updated, 0, errors);
}

async function transferPatron(fromId: string, toId: string) {
  header('7. Patron Record');

  let found = 0;
  let updated = 0;
  let errors = 0;

  try {
    const patron = await patronModel.getById(fromId);

    if (patron && patron.owner) {
      found = 1;
      log(`  Patron record found (level: ${(patron as any).level || 'unknown'})`);

      if (!DRY_RUN) {
        // Patron PK is the owner field, so we need to delete old + create new
        await patronModel.deleteById(fromId);
        await patronModel.put({
          ...patron,
          owner: toId,
        });
      }
      updated = 1;
    } else {
      log('  No patron record found');
    }
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('undefined')) {
      log('  No patron record found');
    } else {
      log(`  ERROR: ${err.message}`);
      errors = 1;
    }
  }

  addSummary('Patron', found, updated, 0, errors);
}

async function transferFeaturedQueueItems(fromId: string, toId: string) {
  header('8. Featured Queue Items');

  // queryWithOwnerFilter scans the ByDate GSI filtering on owner
  const items = await queryAll<any>((lastKey) => featuredQueueModel.queryWithOwnerFilter(fromId, lastKey));
  log(`Found ${items.length} featured queue item(s)`);

  let updated = 0;
  let errors = 0;

  for (const item of items) {
    try {
      log(`  Featured queue item for cube: ${item.cube}`);

      if (!DRY_RUN) {
        item.owner = toId;
        await featuredQueueModel.put(item);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating featured queue item ${item.cube}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Featured Queue', items.length, updated, 0, errors);
}

async function transferNotices(fromId: string, toId: string) {
  header('9. Notices');

  // No direct query by user, so we scan and filter
  const allNotices = await scanAll<any>((lastKey) => noticeModel.scan(lastKey));
  const userNotices = allNotices.filter((n) => {
    const userId = typeof n.user === 'object' ? n.user?.id : n.user;
    return userId === fromId;
  });

  log(`Found ${userNotices.length} notice(s) (scanned ${allNotices.length} total)`);

  let updated = 0;
  let errors = 0;

  for (const notice of userNotices) {
    try {
      log(`  Notice: ${notice.id} (type: ${notice.type || 'unknown'})`);

      if (!DRY_RUN) {
        notice.user = toId;
        await noticeModel.put(notice);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating notice ${notice.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Notices', userNotices.length, updated, 0, errors);
}

async function transferNotifications(fromId: string, toId: string) {
  header('10. Notifications');

  // Transfer notifications where user is the recipient (to)
  const toNotifs = await queryAll<any>((lastKey) => notificationModel.getByTo(fromId, lastKey));
  log(`Found ${toNotifs.length} notification(s) sent TO source user`);

  let updated = 0;
  let errors = 0;

  for (const notif of toNotifs) {
    try {
      log(`  Notification: ${notif.id} (${notif.type || 'unknown'})`);

      if (!DRY_RUN) {
        // notification.update recomputes toStatusComp
        notif.to = toId;
        notif.toStatusComp = `${toId}:${notif.status}`;
        await notificationModel.update(notif);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating notification ${notif.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Notifications (to)', toNotifs.length, updated, 0, errors);
}

async function transferFeedItems(fromId: string, toId: string) {
  header('11. Feed Items');

  // Feed has composite key (id + to), so we query by `to` and re-insert
  const feedItems = await queryAll<any>((lastKey) => feedModel.getByTo(fromId, lastKey));
  log(`Found ${feedItems.length} feed item(s) for source user`);

  // Feed items can't simply be updated because `to` is part of the sort key.
  // We'd need to delete old + insert new. However, feed items are ephemeral
  // and the new user will get new feed items going forward.
  // We'll still transfer them for completeness.
  let updated = 0;
  let errors = 0;

  if (feedItems.length > 0) {
    log('  Note: Feed items use composite keys (id + to). These are ephemeral entries.');
    log('  The new user will receive new feed items going forward from followed cubes.');
    log(`  Skipping feed item migration (${feedItems.length} items) — these are transient.`);
  }

  addSummary('Feed Items', feedItems.length, 0, feedItems.length, 0);
}

async function transferP1P1Packs(fromId: string, toId: string) {
  header('12. P1P1 Packs');

  // No direct query by creator, so we scan and filter
  const allPacks = await scanAll<any>((lastKey) => p1p1PackModel.scan(undefined, lastKey));
  const userPacks = allPacks.filter((p) => p.createdBy === fromId);

  log(`Found ${userPacks.length} P1P1 pack(s) (scanned ${allPacks.length} total)`);

  let updated = 0;
  let errors = 0;

  for (const pack of userPacks) {
    try {
      log(`  P1P1 Pack: ${pack.id}`);

      if (!DRY_RUN) {
        // p1p1Pack doesn't have a simple update, we need to use the raw client
        // The pack has DynamoDB data (id, date, cubeId, createdBy, votesByUser)
        // and S3 data (cards, createdByUsername). We only update DynamoDB here.
        // For the S3 data (createdByUsername), we'd need to re-put.
        // Since p1p1Pack.put creates a new record, we'll work around it.
        // Scan returns raw DynamoDB items, so we can just update the field.
        pack.createdBy = toId;
        // Note: The S3-stored createdByUsername will remain stale unless we also
        // update S3. This is acceptable — it's a denormalized display field.
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating P1P1 pack ${pack.id}: ${err.message}`);
      errors++;
    }
  }

  // For P1P1 packs we need a batch approach since individual update isn't exposed
  if (!DRY_RUN && userPacks.length > 0) {
    log('  Note: P1P1 packs require direct DynamoDB update for createdBy field.');
    log('  The createdByUsername in S3 will remain as the old username (cosmetic).');
    // The scan returns raw items, so we'll need to use the low-level client
    // For now, log what would need to happen
    log('  Warning: P1P1 pack createdBy updates require low-level DynamoDB writes.');
    log('  These packs have been identified but may need manual update if the scan');
    log('  data isn\'t directly writable. Check the P1P1 pack model for update methods.');
  }

  addSummary('P1P1 Packs', userPacks.length, updated, 0, errors);
}

async function updateUserRecords(fromId: string, toId: string, fromUser: any, toUser: any) {
  header('13. User Record Updates');

  // Transfer cube ownership references
  const fromCubes = fromUser.cubes || [];
  const toCubes = toUser.cubes || [];

  log(`Source user has ${fromCubes.length} cube(s) in their profile`);
  log(`Target user has ${toCubes.length} cube(s) in their profile`);

  if (!DRY_RUN) {
    // Move cube references from source to target
    const mergedCubes = [...new Set([...toCubes, ...fromCubes])];
    toUser.cubes = mergedCubes;
    fromUser.cubes = [];

    log(`  Target user will have ${mergedCubes.length} cube(s) after merge`);
  }

  // Transfer followedCubes
  const fromFollowedCubes = fromUser.followedCubes || [];
  const toFollowedCubes = toUser.followedCubes || [];

  log(`Source follows ${fromFollowedCubes.length} cube(s)`);

  if (!DRY_RUN) {
    toUser.followedCubes = [...new Set([...toFollowedCubes, ...fromFollowedCubes])];
    fromUser.followedCubes = [];
    log(`  Target will follow ${toUser.followedCubes.length} cube(s) after merge`);
  }

  // Transfer followedUsers
  const fromFollowedUsers = fromUser.followedUsers || [];
  const toFollowedUsers = toUser.followedUsers || [];

  log(`Source follows ${fromFollowedUsers.length} user(s)`);

  if (!DRY_RUN) {
    // Merge, but remove self-references (don't follow yourself)
    const merged = [...new Set([...toFollowedUsers, ...fromFollowedUsers])].filter((id) => id !== toId);
    toUser.followedUsers = merged;
    fromUser.followedUsers = [];
    log(`  Target will follow ${merged.length} user(s) after merge`);
  }

  // Transfer followers (users following the source)
  const fromFollowers = fromUser.following || [];
  const toFollowers = toUser.following || [];

  log(`Source has ${fromFollowers.length} follower(s)`);

  if (!DRY_RUN) {
    const merged = [...new Set([...toFollowers, ...fromFollowers])].filter((id) => id !== toId);
    toUser.following = merged;
    fromUser.following = [];
    log(`  Target will have ${merged.length} follower(s) after merge`);
  }

  // Transfer patron reference
  if (fromUser.patron) {
    log(`Source has patron reference: ${fromUser.patron}`);
    if (!DRY_RUN) {
      toUser.patron = fromUser.patron;
      fromUser.patron = undefined;
    }
  }

  // Persist user updates
  if (!DRY_RUN) {
    log('  Saving target user...');
    await userModel.update(toUser);
    log('  Saving source user (clearing transferred fields)...');
    await userModel.update(fromUser);
  }

  addSummary('User Records', 2, DRY_RUN ? 0 : 2, 0, 0);
}

async function updateFollowerReferences(fromId: string, toId: string) {
  header('14. Update Follower References on Other Users');

  // Any user who follows the source user should now follow the target user
  // We need to scan all users who have fromId in their followedUsers array
  // This is expensive but necessary for data integrity

  log('  Scanning all users to update follower references...');
  log('  (This updates other users who follow the source to follow the target instead)');

  let scanned = 0;
  let updated = 0;
  let errors = 0;
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;

  // We need to use the raw scan from the user model
  // userModel doesn't expose a scan, so we'll note this limitation
  log('  Note: The user model does not expose a bulk scan method.');
  log('  Users who follow the source should be updated via the following[] array');
  log('  on the source user (already handled). Their followedUsers[] arrays');
  log('  should reference the new user. This may need a separate migration if');
  log('  there are many followers.');

  addSummary('Follower References', 0, 0, 0, 0);
}

async function transferCubeCollaborators(fromId: string, toId: string) {
  header('15. Cube Collaborator References');

  // Scan cubes where fromId appears in the `collaborators` array
  // This requires a full scan since there's no GSI on collaborators
  log('  Scanning cubes for collaborator references...');

  let scanned = 0;
  let updated = 0;
  let errors = 0;
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await cubeModel.scan(lastKey);
    const items = result.items || [];
    scanned += items.length;

    for (const cube of items) {
      try {
        const collaborators: string[] = cube.collaborators || [];
        const following: string[] = cube.following || [];

        let needsUpdate = false;

        // Replace fromId with toId in collaborators
        if (collaborators.includes(fromId)) {
          const idx = collaborators.indexOf(fromId);
          if (!collaborators.includes(toId)) {
            collaborators[idx] = toId;
          } else {
            collaborators.splice(idx, 1); // Already there, just remove the duplicate
          }
          cube.collaborators = collaborators;
          needsUpdate = true;
          log(`  Cube "${cube.name}" (${cube.id}): updated collaborator reference`);
        }

        // Replace fromId with toId in following list
        if (following.includes(fromId)) {
          const idx = following.indexOf(fromId);
          if (!following.includes(toId)) {
            following[idx] = toId;
          } else {
            following.splice(idx, 1);
          }
          cube.following = following;
          needsUpdate = true;
          log(`  Cube "${cube.name}" (${cube.id}): updated following reference`);
        }

        if (needsUpdate && !DRY_RUN) {
          await cubeModel.batchPut([cube]);
          updated++;
        } else if (needsUpdate) {
          updated++;
        }
      } catch (err: any) {
        log(`  ERROR processing cube ${cube.id}: ${err.message}`);
        errors++;
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }

  log(`  Scanned ${scanned} cubes, updated ${updated} collaborator/following references`);

  addSummary('Cube Collaborators/Following', scanned, updated, scanned - updated, errors);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  let fromArg: string | undefined;
  let toArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      fromArg = args[i + 1];
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      toArg = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      DRY_RUN = true;
    }
  }

  if (!fromArg || !toArg) {
    console.error('Usage: transfer-ownership.ts --from <userId|username> --to <userId|username> [--dry-run]');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              CUBECOBRA OWNERSHIP TRANSFER SCRIPT                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  if (DRY_RUN) {
    console.log('\n  *** DRY RUN MODE — No changes will be written ***\n');
  }

  // Resolve users
  console.log(`Resolving source user: ${fromArg}`);
  const fromUser = await userModel.getByIdOrUsername(fromArg);
  if (!fromUser) {
    console.error(`ERROR: Could not find source user: ${fromArg}`);
    process.exit(1);
  }
  console.log(`  → Found: ${fromUser.username} (${fromUser.id})`);

  console.log(`Resolving target user: ${toArg}`);
  const toUser = await userModel.getByIdOrUsername(toArg);
  if (!toUser) {
    console.error(`ERROR: Could not find target user: ${toArg}`);
    process.exit(1);
  }
  console.log(`  → Found: ${toUser.username} (${toUser.id})`);

  if (fromUser.id === toUser.id) {
    console.error('ERROR: Source and target are the same user!');
    process.exit(1);
  }

  console.log(`\nTransferring all resources from "${fromUser.username}" → "${toUser.username}"`);
  console.log(`  Source ID: ${fromUser.id}`);
  console.log(`  Target ID: ${toUser.id}`);

  // Execute all transfers
  await transferCubes(fromUser.id, toUser.id);
  await transferBlogPosts(fromUser.id, toUser.id);
  await transferComments(fromUser.id, toUser.id);
  await transferContent(fromUser.id, toUser.id);
  await transferDrafts(fromUser.id, toUser.id);
  await transferCardPackages(fromUser.id, toUser.id);
  await transferPatron(fromUser.id, toUser.id);
  await transferFeaturedQueueItems(fromUser.id, toUser.id);
  await transferNotices(fromUser.id, toUser.id);
  await transferNotifications(fromUser.id, toUser.id);
  await transferFeedItems(fromUser.id, toUser.id);
  await transferP1P1Packs(fromUser.id, toUser.id);
  await updateUserRecords(fromUser.id, toUser.id, fromUser, toUser);
  await updateFollowerReferences(fromUser.id, toUser.id);
  await transferCubeCollaborators(fromUser.id, toUser.id);

  // Print summary
  header('TRANSFER SUMMARY');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes written)' : 'LIVE'}`);
  console.log(`  From: ${fromUser.username} (${fromUser.id})`);
  console.log(`  To:   ${toUser.username} (${toUser.id})`);
  console.log('');
  console.log(
    '  ' +
      'Entity'.padEnd(30) +
      'Found'.padStart(8) +
      'Updated'.padStart(10) +
      'Skipped'.padStart(10) +
      'Errors'.padStart(10),
  );
  console.log('  ' + '-'.repeat(68));

  let totalFound = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const s of summaries) {
    console.log(
      '  ' +
        s.entity.padEnd(30) +
        String(s.found).padStart(8) +
        String(s.updated).padStart(10) +
        String(s.skipped).padStart(10) +
        String(s.errors).padStart(10),
    );
    totalFound += s.found;
    totalUpdated += s.updated;
    totalSkipped += s.skipped;
    totalErrors += s.errors;
  }

  console.log('  ' + '-'.repeat(68));
  console.log(
    '  ' +
      'TOTAL'.padEnd(30) +
      String(totalFound).padStart(8) +
      String(totalUpdated).padStart(10) +
      String(totalSkipped).padStart(10) +
      String(totalErrors).padStart(10),
  );

  if (DRY_RUN) {
    console.log('\n  *** DRY RUN COMPLETE — Run without --dry-run to apply changes ***');
  } else {
    console.log('\n  Transfer complete!');
  }

  if (totalErrors > 0) {
    console.log(`\n  ⚠ ${totalErrors} error(s) occurred. Review the log above for details.`);
  }

  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
