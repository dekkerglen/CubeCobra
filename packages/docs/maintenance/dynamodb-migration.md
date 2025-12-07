# DynamoDB Migration - Single Table Design

## Overview

Migrating from multiple DynamoDB tables to a single-table design. All DAOs extend `BaseDynamoDao<T, U>` and use the pattern:

- **PK**: `{ENTITY_TYPE}#{ID}`
- **SK**: `{ENTITY_TYPE}` or `DATE#{timestamp}`
- **GSI1, GSI2, GSI3**: Entity-specific query patterns (varies by DAO)

## Migration Status

### ✅ Completed

- **Comments** - `CommentDynamoDao` - Fully migrated
- **Blogs** - `BlogDynamoDao` - DAO ready, pending migration
- **Card History** - `CardHistoryDynamoDao` - DAO ready, pending migration

### 🔄 Pending

Cubes, Users, Decks, Drafts, Feeds, Notifications, Packages, Podcasts, Videos, Articles

## Running Migrations

```bash
cd packages/scripts
npx tsx ./src/dynamoMigrations/migrateComments.ts
npx tsx ./src/dynamoMigrations/migrateBlog.ts
npx tsx ./src/dynamoMigrations/migrateCardHistory.ts
```

Scripts are idempotent and safe to re-run. Require `DYNAMO_TABLE` environment variable.

## Creating a New DAO

1. Extend `BaseDynamoDao<Hydrated, Unhydrated>` in `packages/server/src/dynamo/dao/`
2. Implement: `itemType()`, `partitionKey()`, `GSIKeys()`, `dehydrateItem()`, `hydrateItem()`, `hydrateItems()`
3. Export from `packages/server/src/dynamo/daos.ts`
4. Add `scan()` to old model if needed
5. Create migration script in `packages/scripts/src/dynamoMigrations/`

See existing DAOs (CommentDynamoDao, BlogDynamoDao, CardHistoryDynamoDao) for examples.

### Query Patterns

Example GSI query:

```typescript
protected async queryByGSI(key: string, lastKey?: Record<string, any>): Promise<{
  items: Entity[];
  lastKey?: Record<string, any>;
}> {
  const params: QueryCommandInput = {
    TableName: this.tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :key',
    ExpressionAttributeValues: {
      ':key': `${this.itemType()}#SOMEKEY#${key}`,
    },
    ScanIndexForward: false,
    ExclusiveStartKey: lastKey,
  };

  return this.query(params);
}
```

### Hash Rows

Hash rows enable advanced lookup patterns without GSIs. Use `BaseDynamoDao` methods:

- `getHashes(item)` - Define which hashes to create for an item
- `hash(data)` - Generate deterministic hash from key-value pairs
- `queryByHash(hash)` - Query items by hash

Example: Hash user email for lookup while storing only userId:

```typescript
protected async getHashes(item: Entity): Promise<string[]> {
  if (!item.userEmail) return [];
  return [await this.hash({ email: item.userEmail })];
}
```

Hash rows are written/deleted automatically with `put()`/`delete()`.
