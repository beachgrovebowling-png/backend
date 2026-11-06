function classifyDevice(userAgent = '') {
  const agent = String(userAgent).toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(agent) || (/android/.test(agent) && !/mobile/.test(agent))) return 'tablet';
  if (/mobi|iphone|ipod|windows phone|android.*mobile/.test(agent)) return 'mobile';
  return 'desktop';
}

function detectBrowser(userAgent = '') {
  const agent = String(userAgent);
  if (/edg\//i.test(agent)) return 'Edge';
  if (/opr\//i.test(agent) || /opera/i.test(agent)) return 'Opera';
  if (/firefox\//i.test(agent)) return 'Firefox';
  if (/chrome\//i.test(agent) && !/chromium/i.test(agent)) return 'Chrome';
  if (/safari\//i.test(agent) && !/chrome\//i.test(agent)) return 'Safari';
  return 'Unknown';
}

function normalizePagePath(value) {
  const page = String(value || '');
  if (!page.startsWith('/') || page.startsWith('//') || page.length > 300 || /[\u0000-\u001f\u007f]/.test(page)) return null;
  try {
    const parsed = new URL(page, 'https://bowlersmechanic.invalid');
    if (parsed.origin !== 'https://bowlersmechanic.invalid' || parsed.search) return null;
    return `${parsed.pathname}${parsed.hash}`.slice(0, 300);
  } catch {
    return null;
  }
}

function visitorDateWindows(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const week = new Date(today);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  week.setUTCDate(week.getUTCDate() - daysSinceMonday);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { today, week, month };
}

module.exports = { classifyDevice, detectBrowser, normalizePagePath, visitorDateWindows };
