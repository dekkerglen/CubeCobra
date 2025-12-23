import { NoticeStatus } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

(async () => {
  console.log('Querying notices using noticeDao.getByStatus(NoticeStatus.ACTIVE)');
  console.log('This is the same query used by the admin notice page\n');

  const result = await noticeDao.getByStatus(NoticeStatus.ACTIVE);

  console.log(`Found ${result.items.length} active notices`);

  // Show status distribution
  const statusCounts: Record<string, number> = {};
  result.items.forEach((item) => {
    const status = item.status || 'NO_STATUS';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\nStatus distribution:');
  console.log(JSON.stringify(statusCounts, null, 2));

  // Sample notices
  console.log('\nSample notices (first 5):');
  result.items.slice(0, 5).forEach((item) => {
    console.log({
      id: item.id,
      status: item.status,
      type: item.type,
      date: new Date(item.date),
      subject: item.subject,
    });
  });

  // Check specific IDs that should have been updated
  const testIds = [
    'd85af568-d9c4-4533-9e11-3b36d3c6006f',
    'fff08c45-9c9e-4b2b-82ad-7e7dab5799bb',
    '500497ef-07ca-4e3f-81e9-e60b53f2bd92',
  ];

  console.log(`\n\nChecking if supposedly processed notices are in the active query results:`);
  for (const id of testIds) {
    const found = result.items.find((n) => n.id === id);
    console.log(`  ${id}: ${found ? 'FOUND IN ACTIVE LIST (BAD!)' : 'Not in active list (good)'}`);

    // Also query it directly
    const direct = await noticeDao.getById(id);
    if (direct) {
      console.log(`    Direct query: status='${direct.status}'`);
    }
  }
})();
