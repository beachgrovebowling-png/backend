function emailConfiguration(recipient) {
  const savedRecipient = String(recipient || '').trim();
  return {
    apiKey: String(process.env.RESEND_API_KEY || '').trim(),
    from: String(process.env.VISITOR_NOTIFICATION_FROM || '').trim(),
    to: savedRecipient || String(process.env.VISITOR_NOTIFICATION_EMAIL || '').trim()
  };
}

function missingConfiguration(configuration) {
  const missing = ['apiKey', 'from', 'to'].filter(key => !configuration[key]);
  if (configuration.to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuration.to)) missing.push('to');
  return missing;
}

async function sendEmail(configuration, subject, text) {
  const missing = missingConfiguration(configuration);
  if (missing.length) {
    throw new Error(`Visitor email is not configured. Missing ${missing.join(', ')}.`);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: configuration.from, to: [configuration.to], subject, text }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}.`);
}

async function sendVisitorNotification(visitor, recipient) {
  const configuration = emailConfiguration(recipient);
  const visitTime = new Date(visitor.createdAt).toISOString();
  const text = [
    'Hello,',
    '',
    'Someone has just visited your BowlersMechanic website.',
    '',
    'Visitor activity:',
    `Visit time: ${visitTime}`,
    `Page visited: ${visitor.page}`,
    `Device: ${visitor.device[0].toUpperCase()}${visitor.device.slice(1)}`,
    `Browser: ${visitor.browser}`,
    '',
    'Log in to your admin dashboard to view visitor activity.',
    '',
    'BowlersMechanic Website Notification System.'
  ].join('\n');
  await sendEmail(configuration, 'New Visitor on BowlersMechanic!', text);
}

async function sendTestEmail(recipient) {
  await sendEmail(
    emailConfiguration(recipient),
    'BowlersMechanic visitor notification test',
    'This is a test email from the BowlersMechanic visitor notification system.'
  );
}

function hasEmailConfiguration(recipient) {
  return missingConfiguration(emailConfiguration(recipient)).length === 0;
}

module.exports = { hasEmailConfiguration, sendTestEmail, sendVisitorNotification };
