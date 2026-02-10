import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { normalizeName } from '@utils/cardutil';
import CardPackage, { UnhydratedCardPackage } from '@utils/datatypes/CardPackage';
import UserType from '@utils/datatypes/User';
import { cardFromId } from 'serverutils/carddb';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao, HashRow } from './BaseDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

export type SortOrder = 'votes' | 'date';

export class PackageDynamoDao extends BaseDynamoDao<CardPackage, UnhydratedCardPackage> {
  private readonly userDao: UserDynamoDao;

  constructor(dynamoClient: DynamoDBDocumentClient, userDao: UserDynamoDao, tableName: string) {
    super(dynamoClient, tableName);
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'PACKAGE';
  }

  /**
   * Gets the partition key for a package.
   */
  protected partitionKey(item: CardPackage): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the package.
   * GSI3: Query by owner with date sorting
   * Note: GSI1 and GSI2 are used by hash rows for sorting
   */
  protected GSIKeys(item: CardPackage): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    return {
      GSI1PK: undefined,
      GSI1SK: undefined,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: ownerId ? `${this.itemType()}#OWNER#${ownerId}` : undefined,
      GSI3SK: item.date ? `DATE#${item.date}` : undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a CardPackage to UnhydratedCardPackage for storage.
   */
  protected dehydrateItem(item: CardPackage): UnhydratedCardPackage {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    const cardIds = item.cards
      .map((card) => {
        if (typeof card !== 'string' && card.scryfall_id) {
          return card.scryfall_id;
        } else if (typeof card === 'string') {
          return card;
        }
        return undefined;
      })
      .filter((cardId) => cardId !== undefined) as string[];

    return {
      id: item.id,
      title: item.title,
      date: item.date,
      owner: ownerId!,
      cards: cardIds,
      keywords: item.keywords,
      voters: item.voters,
      voteCount: item.voteCount,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedCardPackage to CardPackage.
   */
  protected async hydrateItem(item: UnhydratedCardPackage): Promise<CardPackage> {
    const owner = await this.userDao.getById(item.owner);

    const cards = item.cards.map((c) => {
      // @ts-expect-error -- Temporary solution for cards accidentally saved to dynamo instead of card ids
      if (typeof c !== 'string' && c.scryfall_id) {
        // @ts-expect-error -- Temporary solution
        return cardFromId(c.scryfall_id);
      } else {
        return cardFromId(c);
      }
    });

    return {
      id: item.id!,
      title: item.title,
      date: item.date,
      owner: owner!,
      cards,
      keywords: item.keywords,
      voters: item.voters,
      voteCount: item.voteCount,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates multiple UnhydratedCardPackages to CardPackages (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedCardPackage[]): Promise<CardPackage[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.map((item) => item.owner).filter(Boolean) as string[];
    const owners = ownerIds.length > 0 ? await this.userDao.batchGet(ownerIds) : [];

    return items.map((item) => {
      const owner = owners.find((o: UserType) => o.id === item.owner);

      const cards = item.cards.map((c) => {
        // @ts-expect-error -- Temporary solution for cards accidentally saved to dynamo instead of card ids
        if (typeof c !== 'string' && c.scryfall_id) {
          // @ts-expect-error -- Temporary solution
          return cardFromId(c.scryfall_id);
        } else {
          return cardFromId(c);
        }
      });

      return {
        id: item.id!,
        title: item.title,
        date: item.date,
        owner: owner!,
        cards,
        keywords: item.keywords,
        voters: item.voters,
        voteCount: item.voteCount,
        dateCreated: item.dateCreated,
        dateLastUpdated: item.dateLastUpdated,
      };
    });
  }

  /**
   * Creates hash rows for a package with GSI keys for sorting.
   * Each hash row has the hash as PK, package ID as SK, and GSI keys for sorting.
   * GSI1: Sort by votes
   * GSI2: Sort by date submitted
   */
  protected async createHashRows(pkg: CardPackage): Promise<any[]> {
    const hashStrings = await this.getHashStrings(pkg);

    return hashStrings.map((hashString) => ({
      PK: `HASH#${this.partitionKey(pkg)}`,
      SK: hashString,
      GSI1PK: hashString,
      GSI1SK: `VOTES#${String(pkg.voteCount).padStart(10, '0')}`,
      GSI2PK: hashString,
      GSI2SK: `DATE#${String(pkg.date).padStart(15, '0')}`,
      // Store metadata for quick access
      packageTitle: pkg.title,
      packageVoteCount: pkg.voteCount,
      packageDate: pkg.date,
      packageId: pkg.id,
    }));
  }

  /**
   * Gets hash strings for a package based on metadata.
   * Creates hashes for:
   * - Global 'package:all' hash for querying all packages
   * - User (owner)
   * - Each card in the package (by scryfall_id)
   * - Each card's oracle_id
   * - Title keywords (monograms, bigrams, trigrams)
   */
  protected async getHashStrings(pkg: CardPackage): Promise<string[]> {
    const hashes: string[] = [];

    // Global hash for all packages
    hashes.push(await this.hash({ type: 'package', value: 'all' }));

    // User hash
    const ownerId = typeof pkg.owner === 'string' ? pkg.owner : pkg.owner?.id;
    if (ownerId) {
      hashes.push(await this.hash({ type: 'user', value: ownerId }));
    }

    // Card hashes (by scryfall_id) and oracle hashes
    for (const card of pkg.cards) {
      const cardId = typeof card === 'string' ? card : card.scryfall_id;
      const oracleId = typeof card === 'string' ? undefined : card.oracle_id;

      if (cardId) {
        hashes.push(await this.hash({ type: 'card', value: cardId }));
      }

      // Add oracle_id hash for card filtering
      if (oracleId) {
        hashes.push(await this.hash({ type: 'oracle', value: oracleId }));
      }
    }

    // Title keyword hashes (monogram, bigram, trigram)
    if (pkg.title) {
      const titleWords = pkg.title
        .replace(/[^\w\s]/gi, '')
        .toLowerCase()
        .split(' ')
        .filter((word: string) => word.length > 0);

      // Monogram (single words)
      for (const word of titleWords) {
        hashes.push(await this.hash({ type: 'keywords', value: word }));
      }

      // Bigram (two consecutive words)
      for (let i = 0; i < titleWords.length - 1; i++) {
        const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
        hashes.push(await this.hash({ type: 'keywords', value: bigram }));
      }

      // Trigram (three consecutive words)
      for (let i = 0; i < titleWords.length - 2; i++) {
        const trigram = `${titleWords[i]} ${titleWords[i + 1]} ${titleWords[i + 2]}`;
        hashes.push(await this.hash({ type: 'keywords', value: trigram }));
      }
    }

    return Array.from(new Set(hashes));
  }

  /**
   * Applies keyword filter to query parameters.
   */
  private applyKeywordFilter(params: QueryCommandInput, keywords: string): QueryCommandInput {
    if (!keywords) {
      return params;
    }

    const words = (keywords?.toLowerCase()?.split(' ') || []).map(normalizeName).map(
      // remove any non-alphanumeric characters
      (word) => word.replace(/[^a-z0-9]/g, ''),
    );

    // all words must exist in the keywords
    params.FilterExpression = words.map((word) => `contains(#keywords, :${word})`).join(' and ');

    params.ExpressionAttributeNames = {
      ...params.ExpressionAttributeNames,
      '#keywords': 'item.keywords',
    };

    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ...words.reduce((acc: Record<string, string>, word) => {
        acc[`:${word}`] = word;
        return acc;
      }, {}),
    };

    return params;
  }

  /**
   * Gets a package by ID.
   */
  public async getById(id: string): Promise<CardPackage | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries all packages sorted by vote count or date.
   * This replaces the old status-based queries.
   */
  public async queryAllPackages(
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    // Use 'package:all' hash to get all packages
    const hashString = await this.hash({ type: 'package', value: 'all' });
    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries packages by oracle ID (contains a specific card).
   */
  public async queryByOracleId(
    oracleId: string,
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    const hashString = await this.hash({ type: 'oracle', value: oracleId });
    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries packages by keyword.
   */
  public async queryByKeyword(
    keyword: string,
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    // Normalize keyword the same way package titles are normalized when storing hashes
    const normalizedKeyword = keyword
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();

    const hashString = await this.hash({ type: 'keywords', value: normalizedKeyword });
    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries packages by owner, ordered by date, with pagination.
   */
  public async queryByOwner(
    owner: string,
    sortBy: SortOrder = 'date',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    // Use hash-based query for user packages
    const hashString = await this.hash({ type: 'user', value: owner });
    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries packages by owner, ordered by date, with keyword filtering and pagination.
   */
  public async queryByOwnerSortedByDate(
    owner: string,
    keywords: string,
    ascending: boolean,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    let params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#OWNER#${owner}`,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    params = this.applyKeywordFilter(params, keywords);

    return this.query(params);
  }

  /**
   * Batch get packages by IDs.
   */
  public async batchGet(ids: string[]): Promise<CardPackage[]> {
    if (ids.length === 0) {
      return [];
    }

    // Get all packages in parallel
    const packages = await Promise.all(
      ids.map((id) =>
        this.get({
          PK: this.typedKey(id),
          SK: this.itemType(),
        }),
      ),
    );

    return packages.filter((pkg): pkg is CardPackage => pkg !== undefined);
  }

  /**
   * Queries packages by a single hash with sorting.
   * @param hashString - The hash string to query
   * @param sortBy - How to sort results ('votes' or 'date')
   * @param ascending - Sort direction
   * @param lastKey - Pagination key
   * @param limit - Maximum number of results
   */
  private async queryByHashWithSort(
    hashString: string,
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    // Choose the GSI based on sort order
    const indexName = sortBy === 'votes' ? 'GSI1' : 'GSI2';

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: `${indexName}PK = :hash`,
      ExpressionAttributeValues: {
        ':hash': hashString,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    console.log('[queryByHashWithSort] Querying with params:', {
      indexName,
      hashString,
      sortBy,
      ascending,
      limit,
    });

    // Use raw query to get hash rows
    const rawResult = await this.dynamoClient.send(new QueryCommand(params));

    console.log('[queryByHashWithSort] Raw result:', {
      itemCount: rawResult.Items?.length || 0,
      hasLastKey: !!rawResult.LastEvaluatedKey,
    });

    if (!rawResult.Items || rawResult.Items.length === 0) {
      return { items: [], lastKey: rawResult.LastEvaluatedKey };
    }

    // Extract package IDs from hash rows
    const packageIds = rawResult.Items.map((item: any) => {
      const pk = item.PK as string;
      console.log('[queryByHashWithSort] Hash row PK:', pk);
      return pk.split('#')[2]; // Extract ID from HASH#PACKAGE#{id}
    }).filter((id: string | undefined): id is string => id !== undefined);

    console.log('[queryByHashWithSort] Extracted package IDs:', packageIds);

    // Batch get the actual packages
    const packages = await this.batchGet(packageIds);

    console.log('[queryByHashWithSort] Retrieved packages:', packages.length);

    return {
      items: packages,
      lastKey: rawResult.LastEvaluatedKey,
    };
  }

  /**
   * Queries packages by hash for IDs only (no hydration).
   * Used by queryByMultipleHashes to avoid hydrating packages that will be filtered out.
   */
  private async queryByHashForIdsOnly(
    hashString: string,
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 100,
  ): Promise<{
    packageIds: string[];
    lastKey?: Record<string, any>;
  }> {
    const indexName = sortBy === 'votes' ? 'GSI1' : 'GSI2';

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: `${indexName}PK = :hash`,
      ExpressionAttributeValues: {
        ':hash': hashString,
      },
      ScanIndexForward: ascending,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    const rawResult = await this.dynamoClient.send(new QueryCommand(params));

    if (!rawResult.Items || rawResult.Items.length === 0) {
      return { packageIds: [], lastKey: rawResult.LastEvaluatedKey };
    }

    const packageIds = rawResult.Items.map((item: any) => {
      const pk = item.PK as string;
      return pk.split('#')[2];
    }).filter((id: string | undefined): id is string => id !== undefined);

    return {
      packageIds,
      lastKey: rawResult.LastEvaluatedKey,
    };
  }

  /**
   * Queries packages by a single hash criterion.
   * @param hashType - Type of hash (e.g., 'user', 'card', 'keywords')
   * @param hashValue - Value to hash
   * @param sortBy - How to sort results
   * @param ascending - Sort direction
   * @param lastKey - Pagination key
   * @param limit - Maximum number of results
   */
  public async queryByHashCriteria(
    hashType: string,
    hashValue: string,
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    const hashString = await this.hash({ type: hashType, value: hashValue });
    return this.queryByHashWithSort(hashString, sortBy, ascending, lastKey, limit);
  }

  /**
   * Queries packages matching ALL provided hash criteria using efficient two-phase querying.
   * 1. Query first hash (should be most restrictive) using GSI for sorting
   * 2. Load hashes for candidates and filter by remaining criteria
   * 3. Return results once we have matches, or continue up to MAX_PAGES
   *
   * @param hashes - Array of hash objects with type and value. First should be most restrictive.
   * @param sortBy - How to sort results ('votes' or 'date')
   * @param ascending - Sort direction
   * @param lastKey - Pagination key
   * @param limit - Maximum results per page
   */
  public async queryByMultipleHashes(
    hashes: Array<{ type: string; value: string }>,
    sortBy: SortOrder = 'votes',
    ascending: boolean = false,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: CardPackage[];
    lastKey?: Record<string, any>;
  }> {
    if (hashes.length === 0) {
      return { items: [] };
    }

    if (hashes.length === 1) {
      // Single hash - use the optimized single-hash query
      const hash = hashes[0]!;
      return this.queryByHashCriteria(hash.type, hash.value, sortBy, ascending, lastKey, limit);
    }

    // Convert all hashes
    const hashStrings = await Promise.all(
      hashes.map(async (hash) => this.hash({ type: hash.type, value: hash.value })),
    );

    // First hash is the primary query (should be most restrictive)
    const primaryHash = hashStrings[0]!;
    // Remaining hashes to filter by
    const filterHashes = new Set(hashStrings.slice(1));

    const MAX_PAGES = 10;
    const PAGE_SIZE = 100;
    let pagesChecked = 0;
    let currentLastKey = lastKey;
    const matchingPackages: CardPackage[] = [];

    // Keep querying pages until we find matches or hit the page limit
    while (pagesChecked < MAX_PAGES && matchingPackages.length === 0) {
      pagesChecked += 1;

      // Query one page of candidates from the first hash
      const candidatesResult = await this.queryByHashForIdsOnly(
        primaryHash,
        sortBy,
        ascending,
        currentLastKey,
        PAGE_SIZE,
      );

      if (candidatesResult.packageIds.length === 0) {
        // No more results
        break;
      }

      // Load all hashes for each candidate package
      const candidateHashes = await Promise.all(
        candidatesResult.packageIds.map(async (packageId) => {
          const result = await this.getHashesForPackage(packageId);
          return {
            packageId,
            hashes: new Set(result.hashes.map((h) => h.SK)),
          };
        }),
      );

      // Filter candidates that have all required hashes
      const matchingIds = candidateHashes
        .filter((candidate) => {
          // Check if this package has all the filter hashes
          for (const requiredHash of filterHashes) {
            if (!candidate.hashes.has(requiredHash)) {
              return false;
            }
          }
          return true;
        })
        .map((candidate) => candidate.packageId);

      if (matchingIds.length > 0) {
        // Found matches! Hydrate packages
        const packages = await this.batchGet(matchingIds);
        matchingPackages.push(...packages);

        // Return with pagination key for next query
        return {
          items: matchingPackages.slice(0, limit),
          lastKey: candidatesResult.lastKey,
        };
      }

      // No matches in this page, continue to next page
      currentLastKey = candidatesResult.lastKey;

      if (!currentLastKey) {
        // No more pages to check
        break;
      }
    }

    // No matches found
    return {
      items: [],
      lastKey: undefined,
    };
  }

  /**
   * Gets all hash rows for a package.
   * Used for cleanup and repair operations.
   */
  public async getHashesForPackage(packageId: string): Promise<{ hashes: HashRow[] }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `HASH#${this.typedKey(packageId)}`,
      },
    };

    const rawResult = await this.dynamoClient.send(new QueryCommand(params));

    const hashes: HashRow[] =
      rawResult.Items?.map((item: any) => ({
        PK: item.PK as string,
        SK: item.SK as string,
      })) || [];

    return { hashes };
  }

  /**
   * Repairs hash rows for a package by comparing current vs expected hashes.
   * Only writes the delta (new hashes and deletes old hashes).
   */
  public async repairHashes(packageId: string): Promise<void> {
    // Get the package
    const pkg = await this.getById(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not found`);
    }

    // Get current hashes
    const currentHashesResult = await this.getHashesForPackage(packageId);
    const currentHashes = new Set(currentHashesResult.hashes.map((h) => h.SK));

    // Generate expected hashes
    const expectedHashRows = await this.createHashRows(pkg);
    const expectedHashes = new Set(expectedHashRows.map((row) => row.SK));

    // Find hashes to add (in expected but not in current)
    const hashesToAdd = expectedHashRows.filter((row) => !currentHashes.has(row.SK));

    // Find hashes to delete (in current but not in expected)
    const hashesToDelete = currentHashesResult.hashes.filter((h) => !expectedHashes.has(h.SK));

    // Batch write the changes
    if (hashesToAdd.length > 0 || hashesToDelete.length > 0) {
      const writeRequests = [
        ...hashesToAdd.map((row) => ({
          PutRequest: {
            Item: row,
          },
        })),
        ...hashesToDelete.map((h) => ({
          DeleteRequest: {
            Key: {
              PK: h.PK,
              SK: h.SK,
            },
          },
        })),
      ];

      // Batch write in chunks of 25 (DynamoDB limit)
      for (let i = 0; i < writeRequests.length; i += 25) {
        const chunk = writeRequests.slice(i, i + 25);
        await this.dynamoClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: chunk,
            },
          }),
        );
      }
    }
  }

  /**
   * Gets hashes for a package (alias for getHashStrings).
   */
  protected async getHashes(pkg: CardPackage): Promise<string[]> {
    return this.getHashStrings(pkg);
  }

  /**
   * Overrides writeHashes to use hash rows with GSI keys.
   */
  protected async writeHashes(itemPK: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    // Get the package to create proper hash rows with metadata
    const pkg = await this.get({
      PK: itemPK,
      SK: this.itemType(),
    });

    if (!pkg) {
      throw new Error('Package not found when writing hashes');
    }

    // Use hash row structure: PK = HASH#PACKAGE#{id}, SK = hashString
    const hashPK = `HASH#${itemPK}`;

    const hashRows = hashes.map((hashString) => ({
      PK: hashPK,
      SK: hashString,
      GSI1PK: hashString,
      GSI1SK: `VOTES#${String(pkg.voteCount).padStart(10, '0')}`,
      GSI2PK: hashString,
      GSI2SK: `DATE#${String(pkg.date).padStart(15, '0')}`,
      packageTitle: pkg.title,
      packageVoteCount: pkg.voteCount,
      packageDate: pkg.date,
    }));

    // Batch writes in chunks of 25 (DynamoDB limit)
    const BATCH_SIZE = 25;
    for (let i = 0; i < hashRows.length; i += BATCH_SIZE) {
      const batch = hashRows.slice(i, i + BATCH_SIZE);

      await this.dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((hashRow) => ({
              PutRequest: {
                Item: hashRow,
              },
            })),
          },
        }),
      );
    }
  }

  /**
   * Deletes hash rows for a package by SK (hash string).
   * @param itemPK - The partition key of the package (PACKAGE#{id})
   * @param hashes - The hash strings (SK values) to delete
   */
  private async deleteHashesBySK(itemPK: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    const hashPK = `HASH#${itemPK}`;
    const hashRows: HashRow[] = hashes.map((hash) => ({
      PK: hashPK,
      SK: hash,
    }));

    // Batch deletes in chunks of 25 (DynamoDB limit)
    const BATCH_SIZE = 25;
    for (let i = 0; i < hashRows.length; i += BATCH_SIZE) {
      const batch = hashRows.slice(i, i + BATCH_SIZE);

      await this.dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((hashRow) => ({
              DeleteRequest: {
                Key: hashRow,
              },
            })),
          },
        }),
      );
    }
  }

  /**
   * Creates a new package with generated ID and proper defaults.
   */
  public async createPackage(
    partial: Omit<UnhydratedCardPackage, 'id' | 'voteCount' | 'dateCreated' | 'dateLastUpdated'>,
  ): Promise<string> {
    const id = uuidv4();
    const now = Date.now();

    const unhydratedPackage: UnhydratedCardPackage = {
      ...partial,
      id,
      voteCount: partial.voters.length,
      dateCreated: now,
      dateLastUpdated: now,
    };

    // Hydrate and write to new table
    const hydratedPackage = await this.hydrateItem(unhydratedPackage);
    await super.put(hydratedPackage);

    return id;
  }

  /**
   * Overrides put to support dual writes and hash rows.
   */
  public async put(item: CardPackage): Promise<void> {
    // Ensure voteCount is in sync with voters length
    const itemWithVoteCount = {
      ...item,
      voteCount: item.voters.length,
    };

    await super.put(itemWithVoteCount);

    // Create hash rows
    const hashes = await this.getHashes(itemWithVoteCount);
    await this.writeHashes(this.partitionKey(itemWithVoteCount), hashes);
  }

  /**
   * Overrides update to support dual writes and hash row updates.
   */
  public async update(item: CardPackage): Promise<void> {
    // Ensure voteCount is in sync with voters length
    const itemWithVoteCount = {
      ...item,
      voteCount: item.voters.length,
    };

    // Get old package to compare hashes
    const oldPackage = await this.get({
      PK: this.partitionKey(itemWithVoteCount),
      SK: this.itemType(),
    });

    if (!oldPackage) {
      // Package doesn't exist, use put instead
      await this.put(itemWithVoteCount);
      return;
    }

    // Update hash rows if metadata changed
    const oldHashes = await this.getHashes(oldPackage);
    const newHashes = await this.getHashes(itemWithVoteCount);

    const hashesToDelete = oldHashes.filter((hash) => !newHashes.includes(hash));
    const hashesToAdd = newHashes.filter((hash) => !oldHashes.includes(hash));

    // Check if GSI sort key data changed (vote count, date, title)
    // These affect the GSI sort keys but don't change which hashes exist
    const gsiDataChanged =
      oldPackage.voteCount !== itemWithVoteCount.voteCount ||
      oldPackage.title !== itemWithVoteCount.title ||
      oldPackage.date !== itemWithVoteCount.date;

    if (hashesToDelete.length > 0) {
      await this.deleteHashesBySK(this.partitionKey(itemWithVoteCount), hashesToDelete);
    }

    if (hashesToAdd.length > 0) {
      await this.writeHashes(this.partitionKey(itemWithVoteCount), hashesToAdd);
    }

    // If GSI data changed, we need to update ALL existing hash rows with new sort keys
    // This happens when vote count, title, or date changes
    if (gsiDataChanged && hashesToDelete.length === 0 && hashesToAdd.length === 0) {
      // The set of hashes didn't change, but the GSI keys need updating
      // We can just rewrite all existing hashes with the new package data
      const unchangedHashes = oldHashes.filter((hash) => newHashes.includes(hash));
      if (unchangedHashes.length > 0) {
        await this.writeHashes(this.partitionKey(itemWithVoteCount), unchangedHashes);
      }
    }

    // Update metadata
    await super.update(itemWithVoteCount);
  }

  /**
   * Overrides delete to support dual writes and hash row cleanup.
   */
  public async delete(item: CardPackage): Promise<void> {
    // Delete hash rows first
    const hashes = await this.getHashes(item);
    if (hashes.length > 0) {
      await this.deleteHashesBySK(this.partitionKey(item), hashes);
    }

    // Delete the package
    await super.delete(item);
  }

  /**
   * Batch put packages.
   */
  public async batchPut(items: CardPackage[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    // Ensure voteCount is in sync with voters length for all items
    const itemsWithVoteCount = items.map((item) => ({
      ...item,
      voteCount: item.voters.length,
    }));

    await super.batchPut(itemsWithVoteCount);

    // Create hash rows for all packages
    const allHashRows: any[] = [];
    for (const item of itemsWithVoteCount) {
      const hashRows = await this.createHashRows(item);
      allHashRows.push(...hashRows);
    }

    // Batch write hash rows in chunks of 25 (DynamoDB limit)
    const BATCH_SIZE = 25;
    for (let i = 0; i < allHashRows.length; i += BATCH_SIZE) {
      const batch = allHashRows.slice(i, i + BATCH_SIZE);

      await this.dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((hashRow) => ({
              PutRequest: {
                Item: hashRow,
              },
            })),
          },
        }),
      );
    }
  }
}
