/**
 * Email Service
 *
 * Abstraction for sending transactional emails.
 * Supports multiple backends: SMTP, SendGrid, AWS SES, or console (dev mode).
 *
 * In production, set EMAIL_PROVIDER and corresponding credentials.
 */

export interface EmailConfig {
  /** Provider: 'smtp' | 'sendgrid' | 'ses' | 'console' */
  provider: 'smtp' | 'sendgrid' | 'ses' | 'console';

  /** From address for all emails */
  fromAddress: string;

  /** From name (e.g. "DotMX Exchange") */
  fromName: string;

  /** Base URL of the application (for link generation) */
  appBaseUrl: string;

  // SMTP config
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;

  // SendGrid config
  sendgridApiKey?: string;

  // AWS SES config
  sesRegion?: string;
  sesAccessKeyId?: string;
  sesSecretAccessKey?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailService {
  /** Send a raw email */
  send(message: EmailMessage): Promise<boolean>;

  /** Send password reset email */
  sendPasswordResetEmail(email: string, token: string): Promise<boolean>;

  /** Send email verification email */
  sendVerificationEmail(email: string, token: string): Promise<boolean>;

  /** Send login alert email */
  sendLoginAlertEmail(email: string, ip: string, userAgent: string): Promise<boolean>;
}

/**
 * Create an email service based on config.
 */
export function createEmailService(config?: Partial<EmailConfig>): EmailService {
  const cfg: EmailConfig = {
    provider: (config?.provider || process.env.EMAIL_PROVIDER || 'console') as EmailConfig['provider'],
    fromAddress: config?.fromAddress || process.env.EMAIL_FROM || 'noreply@dotmx.exchange',
    fromName: config?.fromName || process.env.EMAIL_FROM_NAME || 'DotMX Exchange',
    appBaseUrl: config?.appBaseUrl || process.env.APP_BASE_URL || 'https://dotmx.exchange',
    smtpHost: config?.smtpHost || process.env.SMTP_HOST,
    smtpPort: config?.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: config?.smtpUser || process.env.SMTP_USER,
    smtpPass: config?.smtpPass || process.env.SMTP_PASS,
    smtpSecure: config?.smtpSecure ?? process.env.SMTP_SECURE === 'true',
    sendgridApiKey: config?.sendgridApiKey || process.env.SENDGRID_API_KEY,
    sesRegion: config?.sesRegion || process.env.AWS_REGION || 'us-east-1',
    sesAccessKeyId: config?.sesAccessKeyId || process.env.AWS_ACCESS_KEY_ID,
    sesSecretAccessKey: config?.sesSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
  };

  /**
   * Send email via the configured provider.
   */
  async function send(message: EmailMessage): Promise<boolean> {
    try {
      switch (cfg.provider) {
        case 'sendgrid':
          return await sendViaSendGrid(message);
        case 'smtp':
          return await sendViaSmtp(message);
        case 'ses':
          return await sendViaSES(message);
        case 'console':
        default:
          return sendViaConsole(message);
      }
    } catch (error) {
      console.error(`[Email] Failed to send email to ${message.to}:`, error);
      return false;
    }
  }

  /**
   * Console logger (dev mode)
   */
  function sendViaConsole(message: EmailMessage): boolean {
    console.log(`[Email] ─────────────────────────────────────────`);
    console.log(`[Email] To: ${message.to}`);
    console.log(`[Email] Subject: ${message.subject}`);
    console.log(`[Email] Body: ${message.text}`);
    console.log(`[Email] ─────────────────────────────────────────`);
    return true;
  }

  /**
   * Send via SendGrid HTTP API
   */
  async function sendViaSendGrid(message: EmailMessage): Promise<boolean> {
    if (!cfg.sendgridApiKey) {
      console.error('[Email] SendGrid API key not configured');
      return false;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: cfg.fromAddress, name: cfg.fromName },
        subject: message.subject,
        content: [
          { type: 'text/plain', value: message.text },
          ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Email] SendGrid error ${response.status}: ${body}`);
      return false;
    }

    console.log(`[Email] Sent via SendGrid to ${message.to}: ${message.subject}`);
    return true;
  }

  /**
   * Send via SMTP (uses Bun's built-in fetch for simplicity; in production use nodemailer)
   */
  async function sendViaSmtp(message: EmailMessage): Promise<boolean> {
    // For SMTP, we'll use a simple approach — import nodemailer dynamically if available
    try {
      // @ts-expect-error - optional dependency
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpSecure,
        auth: {
          user: cfg.smtpUser,
          pass: cfg.smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromAddress}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      console.log(`[Email] Sent via SMTP to ${message.to}: ${message.subject}`);
      return true;
    } catch (error) {
      console.error('[Email] SMTP send failed:', error);
      // Fallback to console in dev
      return sendViaConsole(message);
    }
  }

  /**
   * Send via AWS SES HTTP API
   */
  async function sendViaSES(message: EmailMessage): Promise<boolean> {
    try {
      // @ts-expect-error - optional dependency
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      const client = new SESClient({
        region: cfg.sesRegion,
        credentials: cfg.sesAccessKeyId ? {
          accessKeyId: cfg.sesAccessKeyId,
          secretAccessKey: cfg.sesSecretAccessKey || '',
        } : undefined,
      });

      await client.send(new SendEmailCommand({
        Source: `${cfg.fromName} <${cfg.fromAddress}>`,
        Destination: { ToAddresses: [message.to] },
        Message: {
          Subject: { Data: message.subject },
          Body: {
            Text: { Data: message.text },
            ...(message.html ? { Html: { Data: message.html } } : {}),
          },
        },
      }));

      console.log(`[Email] Sent via SES to ${message.to}: ${message.subject}`);
      return true;
    } catch (error) {
      console.error('[Email] SES send failed:', error);
      return sendViaConsole(message);
    }
  }

  // ─── Template Methods ────────────────────────────────────────────────

  async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${cfg.appBaseUrl}/reset-password?token=${token}`;
    return send({
      to: email,
      subject: 'Reset Your DotMX Password',
      text: `You requested a password reset.\n\nClick this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Reset Your Password</h2>
          <p>You requested a password reset for your DotMX account.</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
  }

  async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verifyUrl = `${cfg.appBaseUrl}/verify-email?token=${token}`;
    return send({
      to: email,
      subject: 'Verify Your DotMX Email',
      text: `Welcome to DotMX!\n\nPlease verify your email address:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Verify Your Email</h2>
          <p>Welcome to DotMX! Please verify your email address to get started.</p>
          <p style="margin: 24px 0;">
            <a href="${verifyUrl}" style="background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Verify Email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        </div>
      `,
    });
  }

  async function sendLoginAlertEmail(email: string, ip: string, userAgent: string): Promise<boolean> {
    return send({
      to: email,
      subject: 'New Login to Your DotMX Account',
      text: `A new login was detected on your DotMX account.\n\nIP: ${ip}\nDevice: ${userAgent}\nTime: ${new Date().toISOString()}\n\nIf this wasn't you, please change your password immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">New Login Detected</h2>
          <p>A new login was detected on your DotMX account:</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #666;">IP Address</td><td style="padding: 8px;">${ip}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Device</td><td style="padding: 8px;">${userAgent}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Time</td><td style="padding: 8px;">${new Date().toISOString()}</td></tr>
          </table>
          <p style="color: #e53e3e; font-size: 14px;">If this wasn't you, please change your password immediately.</p>
        </div>
      `,
    });
  }

  return {
    send,
    sendPasswordResetEmail,
    sendVerificationEmail,
    sendLoginAlertEmail,
  };
}
