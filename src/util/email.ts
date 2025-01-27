// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import Email from 'email-templates';
import { createTransport } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import path from 'path';

const IS_HTTPS = process.env?.HTTP_ONLY === 'true' ? false : true;

const getTransportOptions = (): SMTPTransport.Options | undefined => {
  //With SMTP host/port we assume local development mailing
  if (process.env.EMAIL_CONFIG_USERNAME && process.env.EMAIL_CONFIG_PASSWORD) {
    return {
      name: 'CubeCobra.com',
      secure: true,
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_CONFIG_USERNAME,
        pass: process.env.EMAIL_CONFIG_PASSWORD,
      },
    };
  } else if (process.env.EMAIL_CONFIG_SMTP_HOST && process.env.EMAIL_CONFIG_SMTP_PORT) {
    return {
      name: 'CubeCobra.com',
      secure: false,
      host: process.env.EMAIL_CONFIG_SMTP_HOST,
      port: Number(process.env.EMAIL_CONFIG_SMTP_PORT),
    };
  } else {
    return undefined;
  }
};

const getTransport = () => {
  const options = getTransportOptions();
  return options ? createTransport(options) : undefined;
};

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  templateLocals: Record<string, any> = {},
): Promise<any> => {
  const transport = getTransport();
  if (!transport) {
    // eslint-disable-next-line no-console -- Warn so clear why an email isn't being sent
    console.warn('No email transport is configured, skipping sending');
    return undefined;
  }

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
    transport: getTransport(),
  });

  return await message.send({
    template: templateName,
    locals: {
      ...templateLocals,
      //Ensure the common ones cannot be overridden by adding second
      base_url: (IS_HTTPS ? 'https://' : 'http://') + process.env.DOMAIN,
    },
  });
};
export default sendEmail;
