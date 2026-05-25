// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { SendEmailCommand as SESv1SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import Email from 'email-templates';
import { createTransport } from 'nodemailer';
import path from 'path';

import * as utils from './util';

// LocalStack community only implements SES v1, so bypass nodemailer (v2-only) for local dev.
const useLegacySes = process.env.LOCALSTACK_SES === 'true' && process.env.NODE_ENV !== 'production';

const sesV2 = new SESv2Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION || 'us-east-2',
});

const sesV1 = useLegacySes
  ? new SESClient({
      endpoint: process.env.AWS_ENDPOINT || undefined,
      credentials: fromNodeProviderChain(),
      region: process.env.AWS_REGION || 'us-east-2',
    })
  : null;

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
  const shouldSend = process.env.NODE_ENV === 'production' || process.env.LOCALSTACK_SES === 'true';

  const message = new Email({
    message: {
      from: FROM,
      to,
      subject,
    },
    send: shouldSend && !useLegacySes,
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

  if (useLegacySes && sesV1) {
    const rendered = await message.renderAll(templateName, locals);
    const Body: { Html?: { Data: string; Charset: string }; Text?: { Data: string; Charset: string } } = {};
    if (rendered.html) Body.Html = { Data: rendered.html, Charset: 'UTF-8' };
    if (rendered.text) Body.Text = { Data: rendered.text, Charset: 'UTF-8' };
    await sesV1.send(
      new SESv1SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: rendered.subject || subject, Charset: 'UTF-8' },
          Body,
        },
      }),
    );
    return;
  }

  await message.send({
    template: templateName,
    locals,
  });
};
export default sendEmail;
