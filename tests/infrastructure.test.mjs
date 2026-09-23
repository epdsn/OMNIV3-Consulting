import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = JSON.parse(readFileSync(new URL('../infra/template.json', import.meta.url), 'utf8'));

test('deployment email constraints accept normal inboxes and reject malformed addresses', () => {
  for (const name of ['SesFromEmail', 'ContactToEmail']) {
    const pattern = new RegExp(`^(?:${template.Parameters[name].AllowedPattern})$`);
    for (const email of ['forms@omnir3.com', 'contact+website@omnir3.com', 'first.last@example.org']) {
      assert.ok(pattern.test(email), `${name} must accept ${email}`);
    }
    for (const email of ['missing-domain', 'a@b', 'a b@omnir3.com', 'a@omnir3Xcom', '<forms@omnir3.com>', 'a\nb@omnir3.com']) {
      assert.ok(!pattern.test(email), `${name} must reject ${JSON.stringify(email)}`);
    }
  }
});
