import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private transporter?: nodemailer.Transporter;
  private resend?: Resend;
  private fromAddress =
    process.env.MAIL_FROM_ADDRESS ||
    process.env.SMTP_FROM_ADDRESS ||
    process.env.SMTP_SERVER_USER ||
    'noreply@greenco.com';

  constructor() {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      console.log('[MailService] Using Resend API transport.');
      return;
    }

    const smtpHost = process.env.MAIL_HOST || process.env.SMTP_SERVER_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.MAIL_PORT || process.env.SMTP_SERVER_PORT || '587');
    const smtpUser = process.env.MAIL_USERNAME || process.env.SMTP_SERVER_USER;
    const smtpPass = process.env.MAIL_PASSWORD || process.env.SMTP_SERVER_PASS;
    const secure = (process.env.MAIL_SECURE || process.env.SMTP_SERVER_SECURE || 'false') === 'true';
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      ...(process.env.SMTP_SERVER_SERVICE
        ? { service: process.env.SMTP_SERVER_SERVICE }
        : {}),
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
    });

    // Log basic transporter verification on startup so you can see immediately
    // if SMTP credentials or host/port are wrong.
    this.transporter
      .verify()
      .then(() => {
        console.log('[MailService] SMTP connection verified successfully.');
      })
      .catch((err) => {
        console.error('[MailService] SMTP connection verification failed:', err);
      });
  }

  private async sendMail(mailOptions: nodemailer.SendMailOptions) {
    if (this.resend) {
      const to = mailOptions.to
        ? Array.isArray(mailOptions.to)
          ? mailOptions.to.map(String)
          : String(mailOptions.to)
        : undefined;
      const cc = mailOptions.cc
        ? Array.isArray(mailOptions.cc)
          ? mailOptions.cc.map(String)
          : String(mailOptions.cc)
        : undefined;

      await this.resend.emails.send({
        from: String(mailOptions.from || this.fromAddress),
        to,
        cc,
        subject: String(mailOptions.subject || ''),
        text: mailOptions.text ? String(mailOptions.text) : undefined,
        html: mailOptions.html ? String(mailOptions.html) : undefined,
      });
      return null;
    }

    if (!this.transporter) {
      throw new Error('Mail transport is not initialized');
    }
    return this.transporter.sendMail(mailOptions);
  }

  async sendCompanyRegistrationEmail(
    email: string,
    companyName: string,
    password: string,
  ): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/company/login`;
    const brandName = 'Green Co';
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: email,
      subject: 'Welcome to Green Co - Registration Successful',
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Green Co</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f0f9eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0f9eb;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(58,151,61,0.15);overflow:hidden;border:1px solid #A8D94E;">
            <!-- Logo -->
            <tr>
              <td align="center" style="padding:28px 28px 16px 28px;">
                <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#6DC041;color:#FFFFFF;font-size:14px;font-weight:700;letter-spacing:0.02em;">${brandName}</div>
              </td>
            </tr>
            <!-- Welcome banner -->
            <tr>
              <td style="padding:12px 28px 24px 28px;background:linear-gradient(135deg,#e8f5e0 0%,#f0f9eb 100%);border-radius:0 0 24px 24px;">
                <p style="margin:0;color:#3A973D;font-size:28px;font-weight:700;letter-spacing:-0.02em;">Welcome</p>
                <p style="margin:6px 0 0 0;color:#3A973D;font-size:14px;opacity:0.9;">Your company account has been created.</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:24px 28px 10px 28px;">
                <p style="margin:0 0 8px 0;color:#3A973D;font-size:18px;font-weight:700;">Welcome to ${brandName}!</p>
                <p style="margin:0 0 20px 0;color:#3A973D;font-size:15px;">Hello, <strong>${companyName}</strong>,</p>
                <p style="margin:0 0 16px 0;color:#3A973D;font-size:14px;line-height:1.6;opacity:0.9;">Thank you for registering with <strong>${brandName}</strong>. Your company profile has been created and you can now sign in using the credentials below.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:12px;background:#f0f9eb;border:1px solid #A8D94E;margin:0 0 20px 0;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px 0;color:#3A973D;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Your login credentials</p>
                      <p style="margin:0 0 8px 0;color:#3A973D;font-size:12px;opacity:0.85;">Email</p>
                      <p style="margin:0 0 14px 0;color:#3A973D;font-size:14px;font-weight:500;">${email}</p>
                      <p style="margin:0;color:#3A973D;font-size:12px;opacity:0.85;">Temporary password</p>
                      <p style="margin:2px 0 0 0;color:#3A973D;font-size:14px;font-weight:600;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;">${password}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px 0;color:#3A973D;font-size:12px;line-height:1.5;opacity:0.8;">For security, please change this password after your first login. Do not share it with anyone.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:12px;">
                  <tr>
                    <td align="center" style="border-radius:12px;background:#6DC041;">
                      <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Get started</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;text-align:center;color:#3A973D;font-size:11px;opacity:0.8;">Or copy this link: <a href="${loginUrl}" style="color:#6DC041;text-decoration:none;word-break:break-all;">${loginUrl}</a></p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 28px 24px 28px;border-top:1px solid #A8D94E;background:#f0f9eb;">
                <p style="margin:0 0 4px 0;color:#3A973D;font-size:12px;font-weight:600;">Thanks, ${brandName}</p>
                <p style="margin:0 0 8px 0;color:#3A973D;font-size:11px;opacity:0.85;">Sent by ${brandName}. Check our portal for updates.</p>
                <p style="margin:0;color:#3A973D;font-size:11px;opacity:0.8;">© ${new Date().getFullYear()} ${brandName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    };

    // Basic logging so you can see in the Nest console whether the mail was attempted / failed
    try {
      console.log('[MailService] Sending registration email to:', email);
      await this.sendMail(mailOptions);
      console.log('[MailService] Registration email sent successfully to:', email);
    } catch (err) {
      console.error('[MailService] Failed to send registration email to:', email, 'Error:', err);
      throw err;
    }
  }

  async sendForgotPasswordEmail(email: string, password: string): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/company/login`;
    const brandName = 'Green Co';
    const supportEmail = process.env.MAIL_FROM_ADDRESS || 'support@greenco.com';
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: email,
      subject: 'Green Co - Password Reset',
      text: `Green Co Password Reset\n\nEmail: ${email}\nTemporary Password: ${password}\nLogin: ${loginUrl}\n\nIf you did not request this reset, contact support.`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Password Reset - Green Co</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0d2e0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0d2e0f;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#1a3d1c;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);overflow:hidden;border:1px solid #3A973D;">
            <!-- Header: logo -->
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid rgba(168,217,78,0.25);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left">
                      <div style="display:inline-block;padding:6px 14px;border-radius:8px;background:#6DC041;color:#FFFFFF;font-size:14px;font-weight:700;">${brandName}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Hero strip -->
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#3A973D 0%,#6DC041 50%,#A8D94E 100%);">
                <p style="margin:0;color:#FFFFFF;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.95;">Password reset</p>
                <p style="margin:8px 0 0 0;color:#FFFFFF;font-size:24px;font-weight:700;">Reset your password</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:28px 28px 20px 28px;">
                <p style="margin:0 0 12px 0;color:#FFFFFF;font-size:16px;font-weight:600;">Hello,</p>
                <p style="margin:0 0 20px 0;color:#A8D94E;font-size:14px;line-height:1.6;">Your password has been reset. Use the temporary password below to sign in to ${brandName}, then change it for security.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:12px;background:rgba(109,192,65,0.2);border:1px solid #A8D94E;margin:0 0 24px 0;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 6px 0;color:#A8D94E;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Temporary password</p>
                      <p style="margin:0;color:#FFFFFF;font-size:15px;font-weight:600;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;">${password}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:16px;">
                  <tr>
                    <td align="center" style="border-radius:12px;background:#6DC041;">
                      <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Sign in to portal</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;text-align:center;color:#A8D94E;font-size:12px;">Or use this link: <a href="${loginUrl}" style="color:#A8D94E;text-decoration:none;word-break:break-all;">${loginUrl}</a></p>
              </td>
            </tr>
            <!-- Help -->
            <tr>
              <td style="padding:0 28px 24px 28px;">
                <p style="margin:0 0 6px 0;color:#A8D94E;font-size:13px;font-weight:600;">Need help?</p>
                <p style="margin:0;color:#A8D94E;font-size:12px;opacity:0.9;">If you did not request this reset, contact us at <a href="mailto:${supportEmail}" style="color:#A8D94E;text-decoration:none;">${supportEmail}</a></p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 28px 24px 28px;border-top:1px solid rgba(168,217,78,0.25);background:#0d2e0f;">
                <p style="margin:0 0 8px 0;color:#A8D94E;font-size:11px;line-height:1.5;opacity:0.9;">This email was sent to ${email}. If you prefer not to receive these emails, please contact support.</p>
                <p style="margin:0;color:#A8D94E;font-size:11px;opacity:0.8;">© ${new Date().getFullYear()} ${brandName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    };

    const info = await this.sendMail(mailOptions);
    if (info) {
      console.log('[MailService] Forgot password mail response:', {
        to: email,
        accepted: info.accepted,
        rejected: info.rejected,
        messageId: info.messageId,
        response: info.response,
      });
      if (
        Array.isArray(info.rejected) &&
        info.rejected.map(String).includes(email)
      ) {
        throw new Error(`SMTP rejected recipient: ${email}`);
      }
    }
  }

  async sendAdminForgotPasswordEmail(
    email: string,
    password: string,
  ): Promise<void> {
    const loginUrl = `${
      process.env.ADMIN_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3002'
    }/admin/login`;
    const backupEmail = (process.env.ADMIN_FORGOT_PASSWORD_BACKUP_TO || '')
      .trim()
      .toLowerCase();

    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: email,
      ...(backupEmail && backupEmail !== email ? { cc: backupEmail } : {}),
      subject: 'GreenCo Admin - Password Reset',
      text: `GreenCo Admin Password Reset\n\nEmail: ${email}\nTemporary Password: ${password}\nLogin: ${loginUrl}\n\nIf you did not request this reset, contact support immediately.`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GreenCo Admin Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;background:#0f7b2f;color:#ffffff;">
                <h2 style="margin:0;font-size:20px;">GreenCo Admin Password Reset</h2>
                <p style="margin:8px 0 0 0;font-size:13px;opacity:0.95;">Your new temporary password is ready.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 10px 0;font-size:14px;color:#111827;">Hello Admin,</p>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#374151;">
                  Use the temporary password below to sign in. For security, change it immediately after login.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
                  <tr>
                    <td style="padding:16px;">
                      <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">Email</p>
                      <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">${email}</p>
                      <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">Temporary password</p>
                      <p style="margin:0;font-size:16px;font-weight:700;font-family:Consolas,Monaco,monospace;color:#111827;">${password}</p>
                    </td>
                  </tr>
                </table>
                <div style="text-align:center;margin:20px 0 10px 0;">
                  <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:12px 22px;background:#0f7b2f;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Go to Admin Login</a>
                </div>
                <p style="margin:0;text-align:center;font-size:12px;color:#6b7280;">
                  If button does not work: <a href="${loginUrl}" style="color:#0f7b2f;text-decoration:none;">${loginUrl}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    };

    const info = await this.sendMail(mailOptions);
    if (info) {
      console.log('[MailService] Admin forgot password mail response:', {
        to: email,
        cc: backupEmail && backupEmail !== email ? backupEmail : null,
        accepted: info.accepted,
        rejected: info.rejected,
        messageId: info.messageId,
        response: info.response,
      });
      if (
        Array.isArray(info.rejected) &&
        info.rejected.map(String).includes(email)
      ) {
        throw new Error(`SMTP rejected recipient: ${email}`);
      }
    }
  }

  async sendPasswordUpdateEmail(email: string, companyName: string): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/company/login`;
    const brandName = 'Green Co';
    const supportEmail = process.env.MAIL_FROM_ADDRESS || 'support@greenco.com';
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: email,
      subject: 'Green Co - Password Updated',
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Password Updated - Green Co</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0d2e0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0d2e0f;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#1a3d1c;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);overflow:hidden;border:1px solid #3A973D;">
            <!-- Header: logo -->
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid rgba(168,217,78,0.25);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left">
                      <div style="display:inline-block;padding:6px 14px;border-radius:8px;background:#6DC041;color:#FFFFFF;font-size:14px;font-weight:700;">${brandName}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Hero strip -->
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#3A973D 0%,#6DC041 50%,#A8D94E 100%);">
                <p style="margin:0;color:#FFFFFF;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.95;">Confirmation</p>
                <p style="margin:8px 0 0 0;color:#FFFFFF;font-size:24px;font-weight:700;">Password updated</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:28px 28px 20px 28px;">
                <p style="margin:0 0 12px 0;color:#FFFFFF;font-size:16px;">Hello, <strong>${companyName}</strong>,</p>
                <p style="margin:0 0 24px 0;color:#A8D94E;font-size:14px;line-height:1.6;">Your password has been successfully updated. You can sign in with your new password at any time.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:16px;">
                  <tr>
                    <td align="center" style="border-radius:12px;background:#6DC041;">
                      <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Sign in</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Help -->
            <tr>
              <td style="padding:0 28px 24px 28px;">
                <p style="margin:0 0 6px 0;color:#A8D94E;font-size:13px;font-weight:600;">Need help?</p>
                <p style="margin:0;color:#A8D94E;font-size:12px;opacity:0.9;">If you did not make this change, contact us at <a href="mailto:${supportEmail}" style="color:#A8D94E;text-decoration:none;">${supportEmail}</a></p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 28px 24px 28px;border-top:1px solid rgba(168,217,78,0.25);background:#0d2e0f;">
                <p style="margin:0 0 8px 0;color:#A8D94E;font-size:11px;line-height:1.5;opacity:0.9;">This email was sent to ${email}.</p>
                <p style="margin:0;color:#A8D94E;font-size:11px;opacity:0.8;">© ${new Date().getFullYear()} ${brandName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    };

    await this.sendMail(mailOptions);
  }

  /** Facilitator: you have been assigned to a company */
  async sendFacilitatorAssignedToCompanyEmail(
    facilitatorEmail: string,
    facilitatorName: string,
    companyName: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: facilitatorEmail,
      subject: 'GreenCo - Facilitator Assignment',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Facilitator Assignment</h2>
          <p>Dear ${facilitatorName},</p>
          <p>You have been assigned as facilitator to company <strong>${companyName}</strong> by GreenCo Team.</p>
          <p>Please log in to the portal for further details.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company: a facilitator has been assigned to your project */
  async sendCompanyFacilitatorAssignedEmail(
    companyEmail: string,
    companyName: string,
    facilitatorName: string,
    projectCode: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: companyEmail,
      subject: 'GreenCo - Facilitator Assigned to Your Project',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Facilitator Assigned</h2>
          <p>Dear ${companyName},</p>
          <p>Facilitator <strong>${facilitatorName}</strong> has been assigned for your Project ${projectCode} by GreenCo Team.</p>
          <p>Please log in to the portal for further details.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Assessor: you have been assigned to a company (site visit scheduling) */
  async sendAssessorAssignedToCompanyEmail(
    assessorEmail: string,
    assessorName: string,
    companyName: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: assessorEmail,
      subject: 'GreenCo - Assessor Assignment',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Assessor Assignment</h2>
          <p>Dear ${assessorName},</p>
          <p>Company <strong>${companyName}</strong> has been assigned to you as assessor by GreenCo Team.</p>
          <p>Please log in to the portal for site visit details and schedule.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Admin: coordinator has submitted scoring */
  async sendCoordinatorSubmitScoringEmail(adminEmail: string, data: { coordinatorName?: string; projectCode?: string }): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: adminEmail,
      subject: 'GreenCo - Coordinator Submitted Scoring',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Scoring Submitted</h2>
          <p>Coordinator ${data.coordinatorName || 'N/A'} has submitted scoring for project ${data.projectCode || 'N/A'}.</p>
          <p>Please review in the admin portal.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company/Facilitator: checklist/assessment document not accepted */
  async sendChecklistDocNotAcceptedEmail(
    toEmail: string,
    recipientName: string,
    docDetails: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Assessment Document Not Accepted',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Document Not Accepted</h2>
          <p>Dear ${recipientName},</p>
          <p>An assessment/checklist document has not been accepted.</p>
          <p>${docDetails}</p>
          <p>Please log in to the portal to view remarks and resubmit if required.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company/Facilitator: primary data document not accepted */
  async sendPrimaryDocNotAcceptedEmail(
    toEmail: string,
    recipientName: string,
    docDetails: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Primary Data Not Accepted',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Primary Data Not Accepted</h2>
          <p>Dear ${recipientName},</p>
          <p>A primary data section has not been accepted.</p>
          <p>${docDetails}</p>
          <p>Please log in to the portal to view remarks and resubmit if required.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company/Facilitator: primary data section accepted */
  async sendPrimaryDocAcceptedEmail(
    toEmail: string,
    recipientName: string,
    sectionLabel?: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Primary Data Accepted',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Primary Data Accepted</h2>
          <p>Dear ${recipientName},</p>
          <p>A primary data section has been accepted by GreenCo Team.${sectionLabel ? ` Section: ${sectionLabel}` : ''}</p>
          <p>Please log in to the portal to view your project status.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company/Facilitator: invoice (registration fee / proforma / tax) has been raised */
  async sendInvoiceRaisedEmail(
    toEmail: string,
    recipientName: string,
    invoiceType: string,
    projectCode?: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Invoice Raised',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice Raised</h2>
          <p>Dear ${recipientName},</p>
          <p>GreenCo Team has raised the ${invoiceType} for your project${projectCode ? ` (${projectCode})` : ''}.</p>
          <p>Please log in to the portal to view and make payment.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company/Facilitator: payment approved or disapproved */
  async sendPaymentApprovalEmail(
    toEmail: string,
    recipientName: string,
    status: 'Approved' | 'DisApproved',
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: `GreenCo - Payment ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment ${status}</h2>
          <p>Dear ${recipientName},</p>
          <p>GreenCo Team has ${status.toLowerCase()} the payment from your company.</p>
          <p>Please log in to the portal for details.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Company: site visit report has been uploaded (Launch & Training) */
  async sendSiteVisitReportUploadedEmail(
    companyEmail: string,
    companyName: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: companyEmail,
      subject: 'GreenCo - Upload Site Visit Report',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Site Visit Report Uploaded</h2>
          <p>Dear ${companyName},</p>
          <p>The Site Visit Report (Launch & Training) has been uploaded for your project.</p>
          <p>Please log in to the portal to view.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Payment reminder: unpaid invoice (e.g. 15 days after reminder_date) */
  async sendPaymentReminderEmail(toEmail: string, recipientName: string, invoiceType: string): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Payment Reminder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Reminder</h2>
          <p>Dear ${recipientName},</p>
          <p>This is a reminder that your ${invoiceType} payment is pending. Please complete the payment at your earliest.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Proposal document reminder */
  async sendProposalReminderEmail(toEmail: string, recipientName: string): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Upload Proposal Document Reminder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Proposal Document Reminder</h2>
          <p>Dear ${recipientName},</p>
          <p>Please upload the proposal document for your project at your earliest.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Certificate validity / expiry reminder */
  async sendCertificateExpiryEmail(toEmail: string, recipientName: string, expiryDate: string): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Certificate Validity Reminder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Certificate Validity</h2>
          <p>Dear ${recipientName},</p>
          <p>Your GreenCo certificate is valid until ${expiryDate}. Please complete renewal in time.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Sustenance reminder (1st) */
  async sendSustenanceReminderEmail(toEmail: string, recipientName: string): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Upload Sustenance Document',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sustenance Document Reminder</h2>
          <p>Dear ${recipientName},</p>
          <p>Please upload the sustenance document for your project.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /** Sustenance 2 reminder */
  async sendSustenance2ReminderEmail(toEmail: string, recipientName: string): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: toEmail,
      subject: 'GreenCo - Upload Sustenance 2 Document',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sustenance 2 Document Reminder</h2>
          <p>Dear ${recipientName},</p>
          <p>Please upload the second sustenance document for your project.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }

  /**
   * Help Desk: notify company when their ticket is resolved.
   */
  async sendHelpDeskTicketResolvedEmail(
    companyEmail: string,
    companyName: string,
    ticketSubject: string,
    remarks: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM_ADDRESS || 'noreply@greenco.com',
      to: companyEmail,
      subject: 'GreenCo Help Desk - Your query has been resolved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Help Desk – Query Resolved</h2>
          <p>Dear ${companyName},</p>
          <p>Your help desk query has been resolved by GreenCo Admin.</p>
          <p><strong>Subject:</strong> ${ticketSubject}</p>
          <p><strong>Remarks / Resolution:</strong></p>
          <p>${remarks || 'No additional remarks provided.'}</p>
          <p>You can view all your tickets and status in the Help Desk section of the portal.</p>
          <p>Best regards,<br>Green Co Team</p>
        </div>
      `,
    };
    await this.sendMail(mailOptions);
  }
}

