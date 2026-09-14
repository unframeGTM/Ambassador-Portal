import { getIronSession } from 'iron-session';
import { isAdmin } from './admins';

const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'ambassador_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
};

export function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

export function withAuth(handler) {
  return async (req, res) => {
    const session = await getSession(req, res);
    // Ambassadors are identified by contactId; admins may have no Contact record
    // but are authenticated by their verified session email.
    if (!session.contactId && !isAdmin(session.email)) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.session = session;
    return handler(req, res);
  };
}
