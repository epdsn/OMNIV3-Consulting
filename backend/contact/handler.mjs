import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const packages = new Set(['core', 'growth', 'flagship', 'unsure']);
const success = 'Received. We’ll reply within one business day with a plan.';

// Dependencies are injectable so tests never contact AWS or send mail.
export function createHandler({ env = process.env, send, logger = console } = {}) {
  return async (event) => {
    const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const origin = headers.origin;
    const allowed = env.ALLOWED_ORIGIN;
    const reply = (statusCode, message) => ({
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Vary: 'Origin',
        ...(allowed && origin === allowed ? { 'Access-Control-Allow-Origin': allowed } : {}),
      },
      body: JSON.stringify({ message }),
    });
    let validOrigin = false;
    try { validOrigin = new URL(allowed).origin === allowed && new URL(allowed).protocol === 'https:'; } catch {}
    if (!validOrigin || !emailPattern.test(env.SES_FROM_EMAIL ?? '') || !emailPattern.test(env.CONTACT_TO_EMAIL ?? '')) {
      return reply(503, 'Contact service is unavailable. Please try again later.');
    }
    if (origin !== allowed) return reply(403, 'Origin not allowed.');
    if (event.requestContext?.http?.method !== 'POST') return reply(405, 'Method not allowed.');
    if (headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, 'Please send JSON data.');
    if (typeof event.body !== 'string') return reply(400, 'Invalid request body.');
    // Cap encoded input before decoding as well as actual UTF-8 payload size.
    if (event.body.length > 22000) return reply(413, 'Request is too large.');
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    if (Buffer.byteLength(body) > 16000) return reply(413, 'Request is too large.');
    let data;
    try { data = JSON.parse(body); } catch { return reply(400, 'Invalid JSON.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(422, 'Invalid form data.');
    const limits = { name: 100, email: 254, company: 200, package: 20, projectDetails: 5000, website: 200 };
    for (const [field, max] of Object.entries(limits)) {
      if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > max)) return reply(422, 'Invalid form data.');
    }
    // Pretend success for honeypot submissions without sending any email.
    if (data.website?.trim()) return reply(200, success);
    const name = data.name?.trim() ?? '';
    const email = data.email?.trim() ?? '';
    const company = data.company?.trim() ?? '';
    const details = data.projectDetails?.trim() ?? '';
    const selectedPackage = data.package?.trim() || 'unsure';
    if (!name || !emailPattern.test(email) || details.length < 30 || !packages.has(selectedPackage) || /[\r\n\x00-\x1f\x7f]/.test(name + company + email)) {
      return reply(422, 'Please provide a valid name, email, package, and at least 30 characters of project details.');
    }
    try {
      await send({
        FromEmailAddress: env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [env.CONTACT_TO_EMAIL] },
        ReplyToAddresses: [email],
        Content: { Simple: {
          Subject: { Data: 'OmniR3 website inquiry', Charset: 'UTF-8' },
          Body: { Text: { Data: `Name: ${name}\nEmail: ${email}\nCompany: ${company || '(not provided)'}\nPackage: ${selectedPackage}\n\n${details}`, Charset: 'UTF-8' } },
        } },
      });
      return reply(200, success);
    } catch (error) {
      // Do not log request bodies, addresses, or SDK messages containing personal data.
      logger.error('Contact delivery failed', { requestId: event.requestContext?.requestId, errorType: error?.name });
      return reply(502, 'Your message could not be sent. Please try again later.');
    }
  };
}
const client = new SESv2Client({}); // AWS_REGION and role credentials come from Lambda.
export const handler = createHandler({ send: (input) => client.send(new SendEmailCommand(input)) });
