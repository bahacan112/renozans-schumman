import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  logto: {
    endpoint: required('LOGTO_ENDPOINT').replace(/\/$/, ''),
    mgmtResource: process.env.LOGTO_MGMT_RESOURCE || 'https://default.logto.app/api',
    clientId: required('LOGTO_M2M_CLIENT_ID'),
    clientSecret: required('LOGTO_M2M_CLIENT_SECRET'),
  },
  google: {
    webClientId: required('GOOGLE_WEB_CLIENT_ID'),
  },
  smtp: {
    host: required('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 465),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    from: process.env.MAIL_FROM || `Schumann Rezonansı <${process.env.SMTP_USER}>`,
  },
  jwt: {
    secret: required('JWT_SECRET'),
    // seconds
    expiresIn: Number(process.env.JWT_EXPIRES_IN || 60 * 60 * 24 * 30),
  },
  internalSecret: required('INTERNAL_TRIGGER_SECRET'),
  port: Number(process.env.PORT || 4000),
  dev: {
    // When true, password-reset codes are returned in the API response
    // (no email provider wired yet). Set to false once email sending is live.
    exposeResetCode: (process.env.DEV_EXPOSE_RESET_CODE ?? 'true') === 'true',
  },
} as const;
