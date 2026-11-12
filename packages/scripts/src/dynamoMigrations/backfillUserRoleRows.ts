/**
 * Backfill the role rows (UserDynamoDao "Role rows") for users who already hold roles.
 *
 * Why: userDao.listByRole reads a role's holders from one row per (user, role). The DAO writes
 * those rows whenever a user's roles change, but users given roles before then have none.
 *
 * How: walks the USER GSI3 enumeration shards, keeping only users with at least one role (only
 * their id and roles are read back), and writes each one's role rows. Re-running writes the same
 * rows, so it is safe to repeat. The filter still reads every user, so this is a one-time job.
 *
 * Usage (from packages/scripts):
 *   npm run backfill-user-role-rows [-- --dry-run]
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import { UserRoles } from '@utils/datatypes/User';
import { USER_ENUMERATION_SHARDS, UserDynamoDao } from 'dynamo/dao/UserDynamoDao';

import 'dotenv/config';

const main = async (): Promise<void> => {
  const dryRun = process.argv.slice(2).includes('--dry-run');

  const tableName = process.env.DYNAMO_TABLE;
  if (!tableName) {
    throw new Error('DYNAMO_TABLE must be a defined environment variable');
  }
  const userDao = new UserDynamoDao(documentClient, tableName);

  // eslint-disable-next-line no-console
  console.log(`Backfill user role rows | table: ${tableName}${dryRun ? ' | *** DRY RUN ***' : ''}`);

  const counts: Record<string, number> = {};
  let users = 0;

  await Promise.all(
    Array.from({ length: USER_ENUMERATION_SHARDS }, async (_, shard) => {
      let lastKey: Record<string, any> | undefined;
      do {
        const res = await documentClient.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: 'GSI3',
            KeyConditionExpression: 'GSI3PK = :pk',
            FilterExpression: 'size(#item.#roles) > :none',
            ProjectionExpression: 'GSI3SK, #item.#roles',
            ExpressionAttributeNames: { '#item': 'item', '#roles': 'roles' },
            ExpressionAttributeValues: { ':pk': userDao.shardPartitionKey(shard), ':none': 0 },
            ExclusiveStartKey: lastKey,
          }),
        );

        for (const row of res.Items || []) {
          const userId = row.GSI3SK as string;
          const roles = (row.item?.roles || []) as UserRoles[];
          if (!dryRun) {
            await userDao.syncRoleRows(userId, [], roles);
          }
          users += 1;
          for (const role of roles) {
            counts[role] = (counts[role] || 0) + 1;
          }
        }

        lastKey = res.LastEvaluatedKey;
      } while (lastKey);
      // eslint-disable-next-line no-console
      console.log(`[shard ${shard}] done`);
    }),
  );

  // eslint-disable-next-line no-console
  console.log(`Done. users=${users} ${JSON.stringify(counts)}${dryRun ? ' (DRY RUN — no writes)' : ''}`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Backfill failed (safe to re-run):', err);
    process.exit(1);
  });
