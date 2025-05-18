// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import aws from 'aws-sdk';
import Email from 'email-templates';
import { createTransport } from 'nodemailer';
import path from 'path';

import utils from './util';

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const transporter = createTransport({
  SES: new aws.SES({
    apiVersion: '2010-12-01',
    region: 'us-east-2',
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
