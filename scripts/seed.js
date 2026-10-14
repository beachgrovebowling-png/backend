require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const { starterProducts } = require('../src/catalog');

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env before seeding.');
  await mongoose.connect(process.env.MONGODB_URI);

  const imagePath = path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'venom-shock.jpg');
  const product = { ...starterProducts[0], image: fs.existsSync(imagePath) ? '/images/venom-shock.jpg' : null };
  const result = await Product.updateOne({ slug: product.slug }, { $setOnInsert: product }, { upsert: true, runValidators: true });
  console.log(result.upsertedCount ? 'Inserted the clearly marked Motiv Venom Shock starter listing.' : 'Starter listing already exists; existing product data was left unchanged.');
}

seed().catch(error => {
  console.error(`Could not seed catalogue: ${error.message}`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());