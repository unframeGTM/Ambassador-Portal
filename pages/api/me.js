import { withAuth } from '../../lib/session';
import { isAdmin } from '../../lib/admins';

export default withAuth(async function handler(req, res) {
  return res.status(200).json({
    email: req.session.email || null,
    contactName: req.session.contactName || null,
    isAdmin: isAdmin(req.session.email),
  });
});
