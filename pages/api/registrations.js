import { getRegistrationsForContact, createRegistration, getExistingRegistrationForAccount, notifySheaOfDuplicate } from '../../lib/salesforce';
import { withAuth } from '../../lib/session';

export default withAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    const records = await getRegistrationsForContact(req.session.contactId);
    return res.status(200).json(records);
  }

  if (req.method === 'POST') {
    const { accountId, accountName, accountWebsite, tier, notes, isDuplicate, accountDisplayName, referredLeadName, referredLeadEmail } = req.body;

    if (!accountId && !accountName) {
      return res.status(400).json({ error: 'Account is required.' });
    }
    if (!tier) {
      return res.status(400).json({ error: 'Tier is required.' });
    }
    if (referredLeadName && !referredLeadEmail) {
      return res.status(400).json({ error: 'A referred lead email is required when a referred lead is entered.' });
    }

    const status = isDuplicate ? 'On Hold - Dupe Acct Registration' : 'Pending Approval';

    const { id, accountId: resolvedAccountId } = await createRegistration({
      contactId: req.session.contactId,
      accountId,
      accountName,
      accountWebsite,
      tier,
      notes,
      status,
      referredLeadName,
      referredLeadEmail,
    });

    if (isDuplicate && resolvedAccountId) {
      try {
        const existingReg = await getExistingRegistrationForAccount(resolvedAccountId);
        await notifySheaOfDuplicate({
          newAmbassadorName: req.session.contactName || 'Unknown',
          existingReg,
          accountName: accountDisplayName || accountName || 'Unknown Account',
        });
      } catch (err) {
        console.error('Failed to notify Shea of duplicate:', err);
      }
    }

    return res.status(201).json({ id });
  }

  res.status(405).end();
});
