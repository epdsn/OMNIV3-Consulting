import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../backend/contact/handler.mjs';

const env = { ALLOWED_ORIGIN: 'https://omnir3.example', SES_FROM_EMAIL: 'forms@omnir3.example', CONTACT_TO_EMAIL: 'team@omnir3.example' };
const payload = { name: 'Alex', email: 'alex@example.com', company: 'Example', package: 'core', projectDetails: 'We need a new website for our growing business.', website: '' };
const event = (data = payload, overrides = {}) => ({ headers: { origin: env.ALLOWED_ORIGIN, 'content-type': 'application/json' }, requestContext: { http: { method: 'POST' }, requestId: 'test' }, body: JSON.stringify(data), ...overrides });
function setup(options = {}) {
  const sent = [];
  const handler = createHandler({ env, send: async input => sent.push(input), ...options });
  return { handler, sent };
}
test('delivers plain text to configured recipient, with visitor only as reply-to', async () => {
  const { handler, sent } = setup();
  const result = await handler(event());
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['Access-Control-Allow-Origin'], env.ALLOWED_ORIGIN);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].Destination.ToAddresses, [env.CONTACT_TO_EMAIL]);
  assert.equal(sent[0].FromEmailAddress, env.SES_FROM_EMAIL);
  assert.deepEqual(sent[0].ReplyToAddresses, [payload.email]);
  assert.match(sent[0].Content.Simple.Body.Text.Data, /Package: core/);
});
test('rejects foreign, suffix-spoofed, missing and null origins without CORS headers', async () => {
  const { handler, sent } = setup();
  for (const origin of ['https://evil.example', `${env.ALLOWED_ORIGIN}.evil.example`, undefined, 'null']) {
    const result = await handler(event(payload, { headers: { origin, 'content-type': 'application/json' } }));
    assert.equal(result.statusCode, 403);
    assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
  }
  assert.equal(sent.length, 0);
});
test('validates structure, types, limits, email, package and required fields', async () => {
  const { handler, sent } = setup();
  for (const data of [null, [], 1, 'text', {}, {...payload, name: 1}, {...payload, email: {}}, {...payload, company: null}, {...payload, website: []}, {...payload, name: 'x'.repeat(101)}, {...payload, email: 'bad'}, {...payload, email: 'a\r\n@example.com'}, {...payload, name: 'Injected\nName'}, {...payload, package: 'other'}, {...payload, projectDetails: 'short'}, {...payload, projectDetails: 'x'.repeat(5001)}]) {
    assert.equal((await handler(event(data))).statusCode, 422, JSON.stringify(data));
  }
  assert.equal(sent.length, 0);
});
test('rejects malformed, missing, oversized bodies, wrong method and content type', async () => {
  const { handler, sent } = setup();
  for (const [overrides, status] of [[{body:'{'},400],[{body:undefined},400],[{body:'x'.repeat(22001)},413],[{body:'é'.repeat(9000)},413],[{requestContext:{http:{method:'GET'}}},405],[{headers:{origin:env.ALLOWED_ORIGIN,'content-type':'text/plain'}},415]]) {
    assert.equal((await handler(event(payload, overrides))).statusCode, status);
  }
  assert.equal(sent.length, 0);
});
test('honeypot returns apparent success without sending', async () => {
  const { handler, sent } = setup();
  assert.equal((await handler(event({...payload, website:'spam.example'}))).statusCode, 200);
  assert.equal(sent.length, 0);
});
test('handles base64 and case-insensitive headers', async () => {
  const { handler, sent } = setup();
  assert.equal((await handler(event(payload, {body:Buffer.from(JSON.stringify(payload)).toString('base64'), isBase64Encoded:true, headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json; charset=utf-8'}}))).statusCode, 200);
  assert.equal(sent.length, 1);
});
test('configuration fails closed', async () => {
  for (const bad of [{}, {...env, ALLOWED_ORIGIN:'*'}, {...env, ALLOWED_ORIGIN:'https://omnir3.example/'}, {...env, SES_FROM_EMAIL:''}]) {
    const { handler, sent } = setup({env:bad});
    assert.equal((await handler(event())).statusCode, 503);
    assert.equal(sent.length, 0);
  }
});
test('SES failure returns retryable error without exposing provider details', async () => {
  const logs = [];
  const { handler } = setup({send:async () => {throw new Error('private provider detail');},logger:{error:(...args)=>logs.push(args)}});
  const result = await handler(event());
  assert.equal(result.statusCode, 502);
  assert.equal(result.headers['Access-Control-Allow-Origin'], env.ALLOWED_ORIGIN);
  assert.doesNotMatch(result.body, /private provider detail/);
  assert.doesNotMatch(JSON.stringify(logs), /alex@example.com|private provider detail/);
});
