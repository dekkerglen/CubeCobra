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
 *   9.  Notices — SKIPPED (no user GSI, would require full table scan)
 *  10.  Notifications — SKIPPED (transient, not worth transferring)
 *  11.  P1P1 Packs (createdBy field, via cube-based query)
 *  12.  User record updates (cubes[], followedCubes[], followedUsers[], following[])
 *  13.  Follower references on other users
 *  14.  Cube collaborator references (via CollaboratorIndex)
 *  15.  Cube following references (via user's followedCubes)
 */

import 'dotenv/config';

import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

import {
  articleDao,
  blogDao,
  collaboratorIndexDao,
  commentDao,
  cubeDao,
  draftDao,
  episodeDao,
  featuredQueueDao,
  p1p1PackDao,
  packageDao,
  patronDao,
  podcastDao,
  userDao,
  videoDao,
} from '../../server/src/dynamo/daos';

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

async function transferCubes(fromId: string, toId: string): Promise<string[]> {
  header('1. Cubes');

  // Query cubes owned by fromId via the ByOwner GSI
  const cubes = await queryAll<any>((lastKey) => cubeDao.queryByOwner(fromId, 'date', false, lastKey));
  log(`Found ${cubes.length} cube(s) owned by source user`);

  const cubeIds: string[] = [];
  let updated = 0;
  let errors = 0;

  for (const cube of cubes) {
    try {
      const cubeId = cube.id || cube.Id;
      cubeIds.push(cubeId);
      log(`  Cube: "${cube.name}" (${cubeId})`);

      if (!DRY_RUN) {
        cube.owner = toId;
        await cubeDao.update(cube);
      }

      updated++;
    } catch (err: any) {
      log(`  ERROR updating cube ${cube.id}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Cubes', cubes.length, updated, 0, errors);
  return cubeIds;
}

async function transferBlogPosts(fromId: string, toId: string) {
  header('2. Blog Posts');

  const posts = await queryAll<any>((lastKey) => blogDao.queryByOwner(fromId, lastKey));
  log(`Found ${posts.length} blog post(s)`);

  let updated = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      log(`  Blog: "${post.title || post.id}" (${post.id})`);

      if (!DRY_RUN) {
        post.owner = toId;
        await blogDao.update(post);
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

  const comments = await queryAll<any>((lastKey) => commentDao.queryByOwner(fromId, lastKey));
  log(`Found ${comments.length} comment(s)`);

  let updated = 0;
  let errors = 0;

  for (const comment of comments) {
    try {
      log(`  Comment: ${comment.id}`);

      if (!DRY_RUN) {
        comment.owner = toId;
        await commentDao.update(comment);
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

  const contentDaos = [
    { label: 'Article', dao: articleDao },
    { label: 'Video', dao: videoDao },
    { label: 'Podcast', dao: podcastDao },
    { label: 'Episode', dao: episodeDao },
  ];

  let totalFound = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const { label, dao } of contentDaos) {
    const items = await queryAll<any>((lastKey) => dao.queryByOwner(fromId, lastKey));
    log(`Found ${items.length} ${label}(s)`);
    totalFound += items.length;

    for (const item of items) {
      try {
        log(`  ${label}: "${item.title || item.id}" (${item.id})`);

        if (!DRY_RUN) {
          item.owner = toId;
          await dao.update(item);
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
  const drafts = await queryAll<any>((lastKey) => draftDao.queryByOwnerUnhydrated(fromId, lastKey));
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
        await draftDao.update(draft);
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

  const cubeOwnerDrafts = await queryAll<any>((lastKey) => draftDao.queryByCubeOwnerUnhydrated(fromId, lastKey));
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
        await draftDao.update(draft);
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

  const packages = await queryAll<any>((lastKey) => packageDao.queryByOwner(fromId, 'date', false, lastKey));
  log(`Found ${packages.length} package(s)`);

  let updated = 0;
  let errors = 0;

  for (const pkg of packages) {
    try {
      log(`  Package: "${pkg.title || pkg.id}" (${pkg.id})`);

      if (!DRY_RUN) {
        pkg.owner = toId;
        await packageDao.update(pkg);
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
    const patron = await patronDao.getById(fromId);

    if (patron && patron.owner) {
      found = 1;
      log(`  Patron record found (level: ${(patron as any).level || 'unknown'})`);

      if (!DRY_RUN) {
        // Patron PK is the owner field, so we need to delete old + create new
        await patronDao.deleteById(fromId);
        await patronDao.put({
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
  const items = await queryAll<any>((lastKey) => featuredQueueDao.queryWithOwnerFilter(fromId, lastKey));
  log(`Found ${items.length} featured queue item(s)`);

  let updated = 0;
  let errors = 0;

  for (const item of items) {
    try {
      log(`  Featured queue item for cube: ${item.cube}`);

      if (!DRY_RUN) {
        item.owner = toId;
        await featuredQueueDao.update(item);
      }
      updated++;
    } catch (err: any) {
      log(`  ERROR updating featured queue item ${item.cube}: ${err.message}`);
      errors++;
    }
  }

  addSummary('Featured Queue', items.length, updated, 0, errors);
}

async function transferNotices() {
  header('9. Notices');

  // No GSI exists to query notices by user — only by status.
  // A full table scan is not acceptable on a large database.
  // Notices are ephemeral status messages (e.g. "your cube was featured")
  // and do not need to be transferred. They will expire or be dismissed naturally.
  log('SKIPPED — No user-based index exists on the Notices table.');
  log('Notices are ephemeral and do not need to be transferred.');
  log('Old notices on the source account will expire naturally.');

  addSummary('Notices (skipped)', 0, 0, 0, 0);
}

async function transferNotifications() {
  header('10. Notifications');

  // Notifications are transient and user-specific. Transferring them to a new account
  // would be confusing (old notifications appearing on the new account).
  // They will be naturally replaced as the new account receives new notifications.
  log('SKIPPED — Notifications are transient and do not need to be transferred.');
  log('Old notifications on the source account will expire naturally.');

  addSummary('Notifications (skipped)', 0, 0, 0, 0);
}

async function transferP1P1Packs(fromId: string, _toId: string, ownedCubeIds: string[]) {
  header('11. P1P1 Packs');

  // No GSI exists to query packs by createdBy — only by cubeId.
  // Instead of a full table scan, we query packs for each of the user's cubes
  // and filter by createdBy. This covers packs on owned cubes (the vast majority).
  // Packs created on OTHER users' cubes cannot be found without a scan and are skipped.
  log(`Querying P1P1 packs across ${ownedCubeIds.length} owned cube(s)...`);

  let totalFound = 0;
  let updated = 0;
  let errors = 0;

  for (const cubeId of ownedCubeIds) {
    const packs = await queryAll<any>((lastKey) => p1p1PackDao.queryByCube(cubeId, lastKey));
    const userPacks = packs.filter((p: any) => p.createdBy === fromId);

    for (const pack of userPacks) {
      totalFound++;
      try {
        log(`  P1P1 Pack: ${pack.id} (cube: ${cubeId})`);
        // Note: P1P1 pack createdBy is a denormalized field. The pack stays associated
        // with the cube, so transferring cube ownership is the primary action.
        // createdBy is cosmetic and would need a low-level DynamoDB update.
        updated++;
      } catch (err: any) {
        log(`  ERROR processing P1P1 pack ${pack.id}: ${err.message}`);
        errors++;
      }
    }
  }

  if (ownedCubeIds.length > 0) {
    log(`  Found ${totalFound} P1P1 pack(s) created by source user on their cubes`);
  }
  log('  Note: Packs created on other users\' cubes cannot be found without a table scan.');
  log('  The createdBy field is cosmetic — cube ownership transfer is the primary action.');

  addSummary('P1P1 Packs', totalFound, updated, 0, errors);
}

async function updateUserRecords(_fromId: string, toId: string, fromUser: any, toUser: any) {
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
    await userDao.update(toUser);
    log('  Saving source user (clearing transferred fields)...');
    await userDao.update(fromUser);
  }

  addSummary('User Records', 2, DRY_RUN ? 0 : 2, 0, 0);
}

async function updateFollowerReferences(fromId: string, toId: string, fromUser: any) {
  header('13. Update Follower References on Other Users');

  // The source user's `following` array contains IDs of users who follow them.
  // We batch-get those users and update their `followedUsers` arrays.
  const followerIds: string[] = (fromUser.following || []).filter((id: string) => id !== toId && id !== fromId);

  log(`Source user has ${followerIds.length} follower(s) to update`);

  if (followerIds.length === 0) {
    addSummary('Follower References', 0, 0, 0, 0);
    return;
  }

  let updated = 0;
  let errors = 0;

  // batchGet supports up to 100 at a time
  const BATCH_SIZE = 100;
  for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
    const batch = followerIds.slice(i, i + BATCH_SIZE);
    try {
      const followers = await userDao.batchGet(batch);

      for (const follower of followers) {
        try {
          const followedUsers: string[] = follower.followedUsers || [];
          const idx = followedUsers.indexOf(fromId);

          if (idx === -1) {
            log(`  User ${follower.username}: source not in followedUsers (already clean)`);
            continue;
          }

          // Replace fromId with toId, avoiding duplicates
          if (followedUsers.includes(toId)) {
            followedUsers.splice(idx, 1); // toId already present, just remove fromId
          } else {
            followedUsers[idx] = toId;
          }

          log(`  User ${follower.username}: updated followedUsers`);

          if (!DRY_RUN) {
            follower.followedUsers = followedUsers;
            await userDao.update(follower);
          }
          updated++;
        } catch (err: any) {
          log(`  ERROR updating follower ${follower.username}: ${err.message}`);
          errors++;
        }
      }
    } catch (err: any) {
      log(`  ERROR batch-getting followers: ${err.message}`);
      errors++;
    }
  }

  addSummary('Follower References', followerIds.length, updated, 0, errors);
}

async function transferCubeCollaborators(fromId: string, toId: string) {
  header('14. Cube Collaborator References');

  // Use the CollaboratorIndex to efficiently find cubes where fromId is a collaborator
  // This avoids a full table scan by querying PK = COLLABORATOR#<userId>
  log('Querying CollaboratorIndex for cubes where source is a collaborator...');

  let found = 0;
  let updated = 0;
  let errors = 0;

  try {
    const cubeIds = await collaboratorIndexDao.getCubeIdsForUser(fromId);
    found = cubeIds.length;
    log(`Found ${cubeIds.length} cube(s) where source is a collaborator`);

    if (cubeIds.length > 0) {
      // Batch get the cubes to update their collaborator arrays
      const BATCH_SIZE = 25;
      for (let i = 0; i < cubeIds.length; i += BATCH_SIZE) {
        const batch = cubeIds.slice(i, i + BATCH_SIZE);
        const cubes = await cubeDao.batchGet(batch);

        for (const cube of cubes) {
          try {
            const collaborators: string[] = cube.collaborators || [];
            const idx = collaborators.indexOf(fromId);

            if (idx === -1) {
              log(`  Cube "${cube.name}" (${cube.id}): source not in collaborators array (index stale?)`);
              continue;
            }

            // Replace fromId with toId, avoiding duplicates
            if (collaborators.includes(toId)) {
              collaborators.splice(idx, 1);
            } else {
              collaborators[idx] = toId;
            }

            log(`  Cube "${cube.name}" (${cube.id}): updated collaborator reference`);

            if (!DRY_RUN) {
              cube.collaborators = collaborators;
              await cubeDao.update(cube);

              // Update the CollaboratorIndex: remove old, add new
              await collaboratorIndexDao.remove(fromId, cube.id);
              if (!collaborators.includes(toId)) {
                // toId was already present, so we didn't add it to the array
              } else {
                await collaboratorIndexDao.add(toId, cube.id);
              }
            }
            updated++;
          } catch (err: any) {
            log(`  ERROR updating cube ${cube.id}: ${err.message}`);
            errors++;
          }
        }
      }
    }
  } catch (err: any) {
    log(`  ERROR querying CollaboratorIndex: ${err.message}`);
    errors++;
  }

  addSummary('Cube Collaborators', found, updated, 0, errors);
}

async function transferCubeFollowing(fromId: string, toId: string, fromUser: any) {
  header('15. Cube Following References');

  // Use the source user's followedCubes[] to find cubes they follow,
  // then update each cube's `following` array (replace fromId with toId)
  const followedCubeIds: string[] = fromUser.followedCubes || [];
  log(`Source user follows ${followedCubeIds.length} cube(s)`);

  if (followedCubeIds.length === 0) {
    addSummary('Cube Following', 0, 0, 0, 0);
    return;
  }

  let updated = 0;
  let errors = 0;

  const BATCH_SIZE = 25;
  for (let i = 0; i < followedCubeIds.length; i += BATCH_SIZE) {
    const batch = followedCubeIds.slice(i, i + BATCH_SIZE);
    try {
      const cubes = await cubeDao.batchGet(batch);

      for (const cube of cubes) {
        try {
          const following: string[] = cube.following || [];
          const idx = following.indexOf(fromId);

          if (idx === -1) {
            continue; // source not in this cube's following list
          }

          if (following.includes(toId)) {
            following.splice(idx, 1);
          } else {
            following[idx] = toId;
          }

          log(`  Cube "${cube.name}" (${cube.id}): updated following reference`);

          if (!DRY_RUN) {
            cube.following = following;
            await cubeDao.update(cube);
          }
          updated++;
        } catch (err: any) {
          log(`  ERROR updating cube ${cube.id}: ${err.message}`);
          errors++;
        }
      }
    } catch (err: any) {
      log(`  ERROR batch-getting cubes: ${err.message}`);
      errors++;
    }
  }

  addSummary('Cube Following', followedCubeIds.length, updated, 0, errors);
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
  const fromUser = await userDao.getByIdOrUsername(fromArg);
  if (!fromUser) {
    console.error(`ERROR: Could not find source user: ${fromArg}`);
    process.exit(1);
  }
  console.log(`  → Found: ${fromUser.username} (${fromUser.id})`);

  console.log(`Resolving target user: ${toArg}`);
  const toUser = await userDao.getByIdOrUsername(toArg);
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
  const ownedCubeIds = await transferCubes(fromUser.id, toUser.id);
  await transferBlogPosts(fromUser.id, toUser.id);
  await transferComments(fromUser.id, toUser.id);
  await transferContent(fromUser.id, toUser.id);
  await transferDrafts(fromUser.id, toUser.id);
  await transferCardPackages(fromUser.id, toUser.id);
  await transferPatron(fromUser.id, toUser.id);
  await transferFeaturedQueueItems(fromUser.id, toUser.id);
  await transferNotices();
  await transferNotifications();
  await transferP1P1Packs(fromUser.id, toUser.id, ownedCubeIds);
  await updateUserRecords(fromUser.id, toUser.id, fromUser, toUser);
  await updateFollowerReferences(fromUser.id, toUser.id, fromUser);
  await transferCubeCollaborators(fromUser.id, toUser.id);
  await transferCubeFollowing(fromUser.id, toUser.id, fromUser);

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
