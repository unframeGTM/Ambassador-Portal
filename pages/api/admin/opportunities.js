import { getAllAmbassadorOpportunities } from '../../../lib/salesforce';
import { withAuth } from '../../../lib/session';
import { isAdmin } from '../../../lib/admins';

export default withAuth(async function handler(req, res) {
  if (!isAdmin(req.session.email)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  if (req.method !== 'GET') {
    return res.status(405).end();
  }
  const records = await getAllAmbassadorOpportunities();
  return res.status(200).json(records);
});
