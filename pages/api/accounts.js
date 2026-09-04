import { searchAccounts } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(200).json([]);
    const accounts = await searchAccounts(q);
    return res.status(200).json(accounts);
  }
  res.status(405).end();
});
