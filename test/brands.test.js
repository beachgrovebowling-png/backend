const test = require('node:test');
const assert = require('node:assert/strict');
const { BALL_BRANDS, normalizeBallBrand } = require('../src/brands');

test('supported ball brands are limited to the requested list', () => {
  assert.deepEqual(BALL_BRANDS, [
    'Storm', 'Hammer', 'Roto Grip', 'Ebonite', 'Radical', 'Track', 'Motiv',
    'Brunswick', '900 Global', 'Belmo', 'Colombia 300', 'DV8', 'Lane #1', 'Lane Masters'
  ]);
});

test('brand validation accepts listed names case-insensitively and rejects others', () => {
  assert.equal(normalizeBallBrand(' storm '), 'Storm');
  assert.equal(normalizeBallBrand('900 GLOBAL'), '900 Global');
  assert.equal(normalizeBallBrand('Another brand'), null);
});
