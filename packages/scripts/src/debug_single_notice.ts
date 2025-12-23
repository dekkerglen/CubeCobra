import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

/**
 * Debug a single notice to see its actual state in the database
 */
(async () => {
  try {
    // Check one of the IDs that the fix script said was "ALREADY PROCESSED"
    const noticeId = 'd85af568-d9c4-4533-9e11-3b36d3c6006f';

    console.log(`Fetching notice ${noticeId}...`);
    const notice = await noticeDao.getById(noticeId);

    if (!notice) {
      console.log('Notice not found!');
      return;
    }

    console.log('\nNotice details:');
    console.log(
      JSON.stringify(
        {
          id: notice.id,
          status: notice.status,
          type: notice.type,
          date: notice.date,
          dateCreated: notice.dateCreated,
          dateLastUpdated: notice.dateLastUpdated,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
