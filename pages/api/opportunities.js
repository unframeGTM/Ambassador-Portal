import { getOpportunitiesForContact } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    const opps = await getOpportunitiesForContact(req.session.contactId);
    return res.status(200).json(opps);
  }
  res.status(405).end();
});
