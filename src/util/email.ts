// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { SES } from '@aws-sdk/client-ses';
import { fromEnv } from '@aws-sdk/credential-providers';
import Email from 'email-templates';
import { createTransport } from 'nodemailer';
import path from 'path';

import utils from './util';

const transporter = createTransport({
  SES: new SES({
    credentials: fromEnv(),
    region: process.env.AWS_REGION || 'us-east-2',
  }),
});

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  templateLocals: Record<string, any> = {},
): Promise<any> => {
  const message = new Email({
    message: {
      from: process.env.EMAIL_CONFIG_FROM || 'Cube Cobra Team <support@cubecobra.com>',
      to,
      subject,
    },
    send: true,
    juiceResources: {
      webResources: {
        relativeTo: path.join(__dirname, '..', 'public'),
        images: true,
      },
    },
    transport: transporter,
  });

  if (process.env.NODE_ENV === 'production') {
    await message.send({
      template: templateName,
      locals: {
        ...templateLocals,
        //Ensure the common ones cannot be overridden by adding second
        baseUrl: utils.getBaseUrl(),
      },
    });
  } else {
    // In development, just log the email to the console
    // eslint-disable-next-line no-console
    console.log(message);
  }

  return;
};
export default sendEmail;
