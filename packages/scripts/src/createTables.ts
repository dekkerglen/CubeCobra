import blog from '@server/dynamo/models/blog';
import cardhistory from '@server/dynamo/models/cardhistory';
import cubeChangelog from '@server/dynamo/models/changelog';
import content from '@server/dynamo/models/content';
import cubeMetadata from '@server/dynamo/models/cube';
import cubeHash from '@server/dynamo/models/cubeHash';
import dailyP1P1 from '@server/dynamo/models/dailyP1P1';
import draft from '@server/dynamo/models/draft';
import featuredQueue from '@server/dynamo/models/featuredQueue';
import feed from '@server/dynamo/models/feed';
import notice from '@server/dynamo/models/notice';
import notification from '@server/dynamo/models/notification';
import p1p1Pack from '@server/dynamo/models/p1p1Pack';
import pack from '@server/dynamo/models/package';
import passwordReset from '@server/dynamo/models/passwordReset';
import patron from '@server/dynamo/models/patron';
import record from '@server/dynamo/models/record';
import user from '@server/dynamo/models/user';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });

const tables = [
  content,
  notification,
  user,
  notice,
  cubeMetadata,
  cubeHash,
  cubeChangelog,
  blog,
  cardhistory,
  draft,
  pack,
  patron,
  passwordReset,
  featuredQueue,
  feed,
  record,
  p1p1Pack,
  dailyP1P1,
];

(async () => {
  for (const table of tables) {
    try {
      const result = await table.createTable();
      console.log(result);
    } catch (e: any) {
      if (e.name === 'ResourceInUseException') {
        console.log(`Skipping, table already exists`);
      } else {
        console.log(`Error creating table ${table}: ${e}`);
        console.error(e);
      }
    }
  }
  // exit
  process.exit(0);
})();
