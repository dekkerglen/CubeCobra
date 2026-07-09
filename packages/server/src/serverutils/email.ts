// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import Email from 'email-templates';
import { createTransport } from 'nodemailer';
import path from 'path';

import * as utils from './util';

const sesV2 = new SESv2Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION || 'us-east-2',
});

const transporter = createTransport({
  SES: { sesClient: sesV2, SendEmailCommand },
});

const FROM = 'Cube Cobra Team <support@cubecobra.com>';

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  templateLocals: Record<string, any> = {},
): Promise<any> => {
  const shouldSend = process.env.NODE_ENV === 'production';

  const message = new Email({
    message: {
      from: FROM,
      to,
      subject,
    },
    send: shouldSend,
    juiceResources: {
      webResources: {
        relativeTo: path.join(__dirname, '..', 'public'),
        images: true,
      },
    },
    transport: transporter,
    views: {
      root: path.join(__dirname, '..', 'emails'),
    },
  });

  if (!shouldSend) {
    console.log(message);
    return;
  }

  const baseUrl = utils.getBaseUrl();
  const cdnBaseUrl = process.env.CDN_BASE_URL || '';
  const assetsBaseUrl = cdnBaseUrl || baseUrl;
  const locals = { ...templateLocals, baseUrl, assetsBaseUrl };

  await message.send({
    template: templateName,
    locals,
  });
};
export default sendEmail;
