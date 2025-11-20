import { rotateDailyP1P1 } from '@server/serverutils/rotateDailyP1P1';

export const rotateP1P1 = async () => {
  try {
    const result = await rotateDailyP1P1();
    if (result.success) {
      console.log('Daily P1P1 rotation completed successfully.');
    } else {
      console.error('Daily P1P1 rotation failed:', result.message);
    }
  } catch (error) {
    console.error('Daily P1P1 rotation error:', error);
  }
};
