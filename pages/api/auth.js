import crypto from 'crypto';
import { Resend } from 'resend';
import { findContactByEmail } from '../../lib/salesforce';
import { getSession } from '../../lib/session';

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export default async function handler(req, res) {
  if (req.method === 'POST' && req.body.step === 'send') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const contact = await findContactByEmail(email.trim().toLowerCase());
    if (!contact) {
      return res.status(404).json({ error: 'No ambassador found with that email.' });
    }

    const otp = generateOtp();
    const session = await getSession(req, res);
    session.pendingEmail = email.trim().toLowerCase();
    session.pendingContactId = contact.Id;
    session.pendingContactName = contact.Name;
    session.pendingTier = contact.Ambassador_Tier__c || '';
    session.otpHash = hashOtp(otp);
    session.otpExpiry = Date.now() + 10 * 60 * 1000;
    await session.save();

    const { error: sendError } = await resend.emails.send({
      // TODO: verify unframe.ai in Resend (Domains → Add) and switch to 'Unframe Ambassador Portal <ambassadors@unframe.ai>'
      from: 'Unframe Ambassador Portal <onboarding@resend.dev>',
      to: email.trim(),
      subject: 'Your login code',
      html: `
  <div style="font-family: 'Poppins', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #141414;">
    <div style="height: 4px; background: #7800FF; border-radius: 2px; margin-bottom: 24px;"></div>
    <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 20px;"><span style="color: #7800FF;">U</span>nframe</div>
    <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Your login code</h2>
    <p style="color: #3D3D42; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Enter this code in the Ambassador Portal. It expires in 10 minutes.</p>
    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #141414; margin-bottom: 24px;">${otp}</div>
    <p style="font-size: 13px; color: #6E6E75; margin: 0;">If you didn't request this, you can ignore this email.</p>
  </div>
      `,
    });

    if (sendError) {
      console.error('Resend send failed:', sendError);
      const detail = sendError.message || sendError.name || 'email delivery failed';
      return res.status(502).json({
        error: `Could not send the login code: ${detail}. The sender domain may still need verification in Resend.`,
      });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST' && req.body.step === 'verify') {
    const { otp } = req.body;
    const session = await getSession(req, res);

    if (!session.otpHash || !session.otpExpiry) {
      return res.status(400).json({ error: 'No code pending. Please request a new one.' });
    }
    if (Date.now() > session.otpExpiry) {
      session.otpHash = null;
      session.otpExpiry = null;
      await session.save();
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if (hashOtp(String(otp).trim()) !== session.otpHash) {
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    session.contactId = session.pendingContactId;
    session.contactName = session.pendingContactName;
    session.email = session.pendingEmail;
    session.tier = session.pendingTier;
    session.otpHash = null;
    session.otpExpiry = null;
    session.pendingContactId = null;
    session.pendingContactName = null;
    session.pendingEmail = null;
    session.pendingTier = null;
    await session.save();

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const session = await getSession(req, res);
    await session.destroy();
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
