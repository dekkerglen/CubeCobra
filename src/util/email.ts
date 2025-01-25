// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import Email from 'email-templates';
import { createTransport } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import path from 'path';

const getTransportOptions = (): SMTPTransport.Options => {
  //With SMTP host/port we assume local development mailing
  if (process.env.EMAIL_CONFIG_SMTP_HOST && process.env.EMAIL_CONFIG_SMTP_PORT) {
    return {
      name: 'CubeCobra.com',
      secure: false,
      host: process.env.EMAIL_CONFIG_SMTP_HOST,
      port: Number(process.env.EMAIL_CONFIG_SMTP_PORT),
    };
  } else {
    return {
      name: 'CubeCobra.com',
      secure: true,
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_CONFIG_USERNAME,
        pass: process.env.EMAIL_CONFIG_PASSWORD,
      },
    };
  }
};

const getTransport = () => {
  return createTransport(getTransportOptions());
};

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
    transport: getTransport(),
  });

  return await message.send({
    template: templateName,
    locals: templateLocals,
  });
};
export default sendEmail;
