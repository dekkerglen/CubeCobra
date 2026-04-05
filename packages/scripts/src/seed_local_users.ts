/**
 * Seeds a few local dev users for testing the collaborators feature.
 * Run from packages/scripts:
 *   ts-node -r tsconfig-paths/register --project tsconfig.json src/seed_local_users.ts
 *
 * Users created:
 *   alice / password: alice123
 *   bob   / password: bob123
 *   carol / password: carol123
 */

import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import documentClient from '@server/dynamo/documentClient';
import { PutCommand } from '../../server/node_modules/@aws-sdk/lib-dynamodb';

const TABLE = process.env.DYNAMO_TABLE || 'LOCAL_CUBECOBRA';
const SALT_ROUNDS = 10;

const users = [
  { username: 'alice', password: 'alice123' },
  { username: 'bob', password: 'bob123' },
  { username: 'carol', password: 'carol123' },
];

(async () => {
  for (const { username, password } of users) {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const usernameLower = username.toLowerCase();

    // BaseDynamoDao wraps the real data in an "item" field.
    // GSI1SK is always the item type ('USER'), not the username.
    const item = {
      PK: `USER#${id}`,
      SK: 'USER',
      GSI1PK: `USER#USERNAME#${usernameLower}`,
      GSI1SK: 'USER',
      DynamoVersion: 1,
      item: {
        id,
        username,
        usernameLower,
        passwordHash,
        email: `${username}@local.dev`,
        emailVerified: true,
        about: '',
        imageName: 'Ambush Viper',
        roles: [],
        theme: 'system',
        hideFeatured: false,
        followedCubes: [],
        followedUsers: [],
        notifications: [],
        patron: '',
      },
    };

    await documentClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    console.log(`Created user: ${username} / ${password}  (id: ${id})`);
  }

  console.log('\nDone. Sign in at http://localhost:8080/user/login');
})();
