const BALL_BRANDS = Object.freeze([
  'Storm',
  'Hammer',
  'Roto Grip',
  'Ebonite',
  'Radical',
  'Track',
  'Motiv',
  'Brunswick',
  '900 Global',
  'Belmo',
  'Colombia 300',
  'DV8',
  'Lane #1',
  'Lane Masters'
]);

function normalizeBallBrand(value) {
  const name = String(value || '').trim().toLocaleLowerCase();
  return BALL_BRANDS.find(brand => brand.toLocaleLowerCase() === name) || null;
}

module.exports = { BALL_BRANDS, normalizeBallBrand };
