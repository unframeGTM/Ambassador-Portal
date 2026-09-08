import jsforce from 'jsforce';

let _conn = null;

export async function getSFConnection() {
  if (_conn && _conn.accessToken) return _conn;

  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  });

  await conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD);
  _conn = conn;
  return conn;
}

export async function findContactByEmail(email) {
  const conn = await getSFConnection();
  const result = await conn.query(
    `SELECT Id, Name, Email, AccountId, Ambassador_Tier__c, Ambassador_Status__c
     FROM Contact
     WHERE Email = '${email.replace(/'/g, "\\'")}'
     LIMIT 1`
  );
  return result.records[0] || null;
}

export async function getRegistrationsForContact(contactId) {
  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT
      Id, Name, Status__c, Tier__c, Notes__c,
      Account__r.Name,
      Ambassador__r.Name,
      Lead__r.Name,
      Approval_Date__c,
      Introduction_Date__c,
      Intro_Meeting_Date__c,
      Intro_Window_Expiry__c,
      Intro_Window_Extended__c,
      Close_Window_Expiry__c,
      Registration_Expiry__c,
      Upsell_Eligibility_Expiry__c,
      CreatedDate
    FROM Ambassador_Registration__c
    WHERE Ambassador__c = '${contactId}'
    ORDER BY CreatedDate DESC
  `);
  return result.records;
}

export async function getOpportunitiesForContact(contactId) {
  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT Id, Name, StageName, CloseDate, Account.Name
    FROM Opportunity
    WHERE Id IN (
      SELECT OpportunityId FROM OpportunityContactRole WHERE ContactId = '${contactId}'
    )
    ORDER BY LastModifiedDate DESC
    LIMIT 20
  `);
  return result.records;
}

async function resolveReferredLead(conn, { name, email, accountId, accountName }) {
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) return null;

  // If a lead with this email already exists, reuse it.
  const existing = await conn.query(
    `SELECT Id FROM Lead WHERE Email = '${cleanEmail.replace(/'/g, "\\'")}' LIMIT 1`
  );
  if (existing.records.length > 0) return existing.records[0].Id;

  // Otherwise create a new referral lead.
  let company = accountName;
  if (!company && accountId) {
    const acct = await conn.query(`SELECT Name FROM Account WHERE Id = '${accountId}' LIMIT 1`);
    company = acct.records[0]?.Name;
  }
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] || 'Referral');
  const firstName = parts.length > 1 ? parts[0] : undefined;

  const created = await conn.sobject('Lead').create({
    FirstName: firstName,
    LastName: lastName,
    Company: company || 'Referral',
    Email: cleanEmail,
    LeadSource: 'Referral',
  });
  if (!created.success) throw new Error('Could not create referred lead: ' + created.errors.join(', '));
  return created.id;
}

export async function createRegistration({ contactId, accountId, accountName, accountWebsite, tier, notes, status, referredLeadName, referredLeadEmail }) {
  const conn = await getSFConnection();

  if (!accountId) {
    if (!accountWebsite) throw new Error('A website/domain is required for new companies.');

    const domain = accountWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const existing = await conn.query(
      `SELECT Id FROM Account WHERE Website LIKE '%${domain}%' LIMIT 1`
    );
    if (existing.records.length > 0) {
      accountId = existing.records[0].Id;
    } else {
      const created = await conn.sobject('Account').create({
        Name: accountName,
        Website: accountWebsite.startsWith('http') ? accountWebsite : `https://${accountWebsite}`,
      });
      if (!created.success) throw new Error('Could not create account: ' + created.errors.join(', '));
      accountId = created.id;
    }
  }

  const leadId = await resolveReferredLead(conn, {
    name: referredLeadName,
    email: referredLeadEmail,
    accountId,
    accountName,
  });

  const fields = {
    Ambassador__c: contactId,
    Account__c: accountId,
    Tier__c: tier,
    Notes__c: notes,
    Status__c: status || 'Pending Approval',
  };
  if (leadId) fields.Lead__c = leadId;

  const result = await conn.sobject('Ambassador_Registration__c').create(fields);
  if (!result.success) throw new Error(result.errors.join(', '));
  return { id: result.id, accountId, leadId };
}

export async function getExistingRegistrationForAccount(accountId) {
  const conn = await getSFConnection();
  const result = await conn.query(`
    SELECT Id, Ambassador__r.Name, Approval_Date__c, Intro_Window_Expiry__c
    FROM Ambassador_Registration__c
    WHERE Account__c = '${accountId}'
      AND Status__c IN ('Approved', 'Intro Made', 'Active')
    ORDER BY CreatedDate DESC
    LIMIT 1
  `);
  return result.records[0] || null;
}

export async function notifySheaOfDuplicate({ newAmbassadorName, existingReg, accountName }) {
  const conn = await getSFConnection();
  const userResult = await conn.query(
    `SELECT Id FROM User WHERE Name LIKE '%Shea%' AND IsActive = true LIMIT 1`
  );
  if (!userResult.records.length) return;

  const existingAmbassador = existingReg?.['Ambassador__r']?.Name || 'Unknown';
  const approvalDate = existingReg?.Approval_Date__c || 'N/A';
  const introExpiry = existingReg?.Intro_Window_Expiry__c || 'N/A';

  await conn.sobject('Task').create({
    OwnerId: userResult.records[0].Id,
    Subject: `Duplicate Registration — ${accountName}`,
    Description: `A new ambassador submitted a registration for an already-held account.\n\nAccount: ${accountName}\nNew applicant: ${newAmbassadorName}\nExisting ambassador: ${existingAmbassador}\nApproval Date: ${approvalDate}\nIntro Window Expiry: ${introExpiry}`,
    Status: 'Not Started',
    Priority: 'High',
    ActivityDate: new Date().toISOString().split('T')[0],
  });
}

export async function searchAccounts(query) {
  const conn = await getSFConnection();
  const escaped = query.replace(/'/g, "\\'");
  const result = await conn.query(
    `SELECT Id, Name, Website, Registration_Active__c, Registered_Ambassador__r.Name
     FROM Account
     WHERE Name LIKE '%${escaped}%'
     ORDER BY Name
     LIMIT 20`
  );
  return result.records;
}
