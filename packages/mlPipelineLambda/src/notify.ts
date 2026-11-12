import { notificationDao, userDao } from '@server/dynamo/daos';
import { UserRoles } from '@utils/datatypes/User';

// The ML Retraining tab of the admin dashboard.
const RUNS_URL = '/admin/dashboard?tab=mlretraining';

/**
 * Sends every admin a site notification, from the site account like the other system notifications
 * (serverutils/util addNotification). Failing to notify is logged, not thrown: it shouldn't fail the
 * step that records the run.
 */
export const notifyAdmins = async (body: string): Promise<void> => {
  try {
    const admins = await userDao.listByRole(UserRoles.ADMIN);
    const date = Date.now();
    await Promise.all(
      admins.map((admin) =>
        notificationDao.put({
          date,
          to: admin.id,
          from: '5d1125b00e0713602c55d967',
          fromUsername: 'Dekkaru',
          url: RUNS_URL,
          body,
        }),
      ),
    );
    console.log(`Notified ${admins.length} admins: ${body}`);
  } catch (error) {
    console.error(`Could not notify the admins: ${error instanceof Error ? error.message : String(error)}`);
  }
};
