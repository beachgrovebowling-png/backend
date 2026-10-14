const catalogCategories = [
  { slug: 'performance-bowling-balls', name: 'Performance Bowling Balls', description: 'High-performance equipment for serious players.', sortOrder: 1, published: true },
  { slug: 'beginner-bowling-balls', name: 'Beginner Bowling Balls', description: 'Entry-level pieces for developing players.', sortOrder: 2, published: true },
  { slug: 'spare-bowling-balls', name: 'Spare Bowling Balls', description: 'Specialized spare and control options.', sortOrder: 3, published: true },
  { slug: 'bowling-ball-accessories', name: 'Bowling Ball Accessories', description: 'Essential accessories and maintenance products.', sortOrder: 4, published: true }
];

const starterProducts = [
  {
    slug: 'storm-phaze-ii',
    name: 'Storm Phaze II',
    brand: 'Storm',
    category: 'performance-bowling-balls',
    description: 'A versatile performance ball built for control, smooth motion, and dependable backend reaction.',
    shortDescription: 'Versatile performance ball for smooth reaction.',
    fullDescription: 'A versatile performance ball built for control, smooth motion, and dependable backend reaction.',
    image: null,
    gallery: [],
    price: null,
    salePrice: null,
    priceConfirmed: false,
    availability: 'contact',
    stockQuantity: null,
    featured: true,
    isStarter: true,
    active: true,
    weights: [],
    pricingRule: 'contact',
    offers: []
  },
  {
    slug: 'storm-summit',
    name: 'Storm Summit',
    brand: 'Storm',
    category: 'performance-bowling-balls',
    description: 'A stronger backend option for players seeking more angular motion and confident downlane shape.',
    shortDescription: 'Stronger backend reaction for more aggressive players.',
    fullDescription: 'A stronger backend option for players seeking more angular motion and confident downlane shape.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'storm-ion-pro',
    name: 'Storm Ion Pro',
    brand: 'Storm',
    category: 'performance-bowling-balls',
    description: 'Balanced performance for players who want a dependable entry-to-midlane shape with carry behind it.',
    shortDescription: 'Balanced performance option.',
    fullDescription: 'Balanced performance for players who want a dependable entry-to-midlane shape with carry behind it.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'storm-virtual-energy-blackout',
    name: 'Virtual Energy Blackout',
    brand: 'Storm',
    category: 'performance-bowling-balls',
    description: 'A high-performance option with extra footprint and a long, smooth response through the pins.',
    shortDescription: 'High-performance blend of power and control.',
    fullDescription: 'A high-performance option with extra footprint and a long, smooth response through the pins.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'roto-grip-gem',
    name: 'Roto Grip Gem',
    brand: 'Roto Grip',
    category: 'performance-bowling-balls',
    description: 'A popular benchmark option with controllable response and a versatile pattern for many approaches.',
    shortDescription: 'Benchmark ball with controllable response.',
    fullDescription: 'A popular benchmark option with controllable response and a versatile pattern for many approaches.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'roto-grip-attention-star',
    name: 'Attention Star',
    brand: 'Roto Grip',
    category: 'performance-bowling-balls',
    description: 'A performance staple that blends strong carry with an aggressive, readable arc on the lane.',
    shortDescription: 'Balanced performance with strong carry.',
    fullDescription: 'A performance staple that blends strong carry with an aggressive, readable arc on the lane.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'motiv-jackal-ghost',
    name: 'Jackal Ghost',
    brand: 'Motiv',
    category: 'performance-bowling-balls',
    description: 'An aggressive, modern performance ball designed to provide strong movement and a predictable read.',
    shortDescription: 'Modern performance ball with strong, readable movement.',
    fullDescription: 'An aggressive, modern performance ball designed to provide strong movement and a predictable read.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'motiv-venom-shock',
    name: 'Venom Shock',
    brand: 'Motiv',
    category: 'performance-bowling-balls',
    description: 'A high-performance polygonal ball with a strong visual identity, smooth motion, and heavy carry.',
    shortDescription: 'High-performance ball with smooth motion and strong carry.',
    fullDescription: 'A high-performance polygonal ball with a strong visual identity, smooth motion, and heavy carry.',
    image: '/images/venom-feature.svg',
    gallery: [{ url: '/images/venom-feature.svg', alt: 'Motiv Venom Shock bowling ball and box photo' }],
    price: null,
    salePrice: null,
    priceConfirmed: false,
    availability: 'contact',
    stockQuantity: null,
    featured: true,
    isStarter: true,
    active: true,
    weights: [],
    pricingRule: 'contact',
    offers: []
  },
  {
    slug: 'hammer-black-widow-3-0',
    name: 'Black Widow 3.0',
    brand: 'Hammer',
    category: 'performance-bowling-balls',
    description: 'High-energy motion and a strong entry that many players rely on for control and pin carry.',
    shortDescription: 'High-energy ball with reliable pin carry.',
    fullDescription: 'High-energy motion and a strong entry that many players rely on for control and pin carry.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'brunswick-mesmerize',
    name: 'Mesmerize',
    brand: 'Brunswick',
    category: 'performance-bowling-balls',
    description: 'An all-around performance ball with a clean response and enough strength to handle a wide range of lane conditions.',
    shortDescription: 'All-around option for lots of conditions.',
    fullDescription: 'An all-around performance ball with a clean response and enough strength to handle a wide range of lane conditions.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'brunswick-rhino',
    name: 'Rhino',
    brand: 'Brunswick',
    category: 'beginner-bowling-balls',
    description: 'A beginner-friendly ball designed for smooth motion, forgiving reaction, and easier entry into the game.',
    shortDescription: 'Easy-to-use starter ball for developing players.',
    fullDescription: 'A beginner-friendly ball designed for smooth motion, forgiving reaction, and easier entry into the game.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'storm-tropical-surge',
    name: 'Tropical Surge',
    brand: 'Storm',
    category: 'beginner-bowling-balls',
    description: 'A forgiving starter option with accessible reaction and a comfortable entry point for new bowlers.',
    shortDescription: 'Forgiving option for new bowlers.',
    fullDescription: 'A forgiving starter option with accessible reaction and a comfortable entry point for new bowlers.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'hammer-raw',
    name: 'Raw',
    brand: 'Hammer',
    category: 'beginner-bowling-balls',
    description: 'A beginner-focused ball chosen for approachable response and dependable results for developing players.',
    shortDescription: 'Dependable beginner ball with easy reaction.',
    fullDescription: 'A beginner-focused ball chosen for approachable response and dependable results for developing players.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'columbia-300-messenger',
    name: 'Messenger',
    brand: 'Columbia 300',
    category: 'beginner-bowling-balls',
    description: 'A straightforward beginner ball that helps players learn a consistent movement and reliable carry.',
    shortDescription: 'Straightforward option for new bowlers.',
    fullDescription: 'A straightforward beginner ball that helps players learn a consistent movement and reliable carry.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'motiv-thrill',
    name: 'Thrill',
    brand: 'Motiv',
    category: 'beginner-bowling-balls',
    description: 'An approachable bowling ball that balances easy motion with enough energy to help players learn.',
    shortDescription: 'Approachable ball for learning fundamentals.',
    fullDescription: 'An approachable bowling ball that balances easy motion with enough energy to help players learn.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'storm-ice-spare-ball',
    name: 'Ice Spare Ball',
    brand: 'Storm',
    category: 'spare-bowling-balls',
    description: 'A dedicated spare ball with clear quantity-based pricing available from the owner for 1 or 2 balls.',
    shortDescription: 'Dedicated spare ball with quantity pricing.',
    fullDescription: 'A dedicated spare ball with clear quantity-based pricing available from the owner for 1 or 2 balls.',
    image: null, gallery: [], price: 100, salePrice: null, priceConfirmed: true, availability: 'available', stockQuantity: null, featured: true, isStarter: true, active: true, weights: [], pricingRule: 'storm-ice-quantity-offer', offers: [
      { id: 'storm-ice-one', label: 'One ball', price: 100, quantity: 1, active: true },
      { id: 'storm-ice-two', label: 'Two balls', price: 170, quantity: 2, active: true }
    ]
  },
  {
    slug: 'brunswick-tzone',
    name: 'TZone',
    brand: 'Brunswick',
    category: 'spare-bowling-balls',
    description: 'A trusted spare ball that helps players stay consistent with reliable control and easy visual targeting.',
    shortDescription: 'Trusted spare ball with reliable control.',
    fullDescription: 'A trusted spare ball that helps players stay consistent with reliable control and easy visual targeting.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'columbia-300-white-dot',
    name: 'White Dot',
    brand: 'Columbia 300',
    category: 'spare-bowling-balls',
    description: 'A classic spare option focused on comfort, control, and clean execution when the lane is tight.',
    shortDescription: 'Classic spare option for control and comfort.',
    fullDescription: 'A classic spare option focused on comfort, control, and clean execution when the lane is tight.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'pyramid-path-rising',
    name: 'Path Rising',
    brand: 'Pyramid',
    category: 'spare-bowling-balls',
    description: 'A versatile spare option built for easy handling and dependable finishing on a wide range of lanes.',
    shortDescription: 'Versatile spare ball for all-around use.',
    fullDescription: 'A versatile spare option built for easy handling and dependable finishing on a wide range of lanes.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'bowling-ball-cleaner',
    name: 'Bowling Ball Cleaner',
    brand: 'Shop Supply',
    category: 'bowling-ball-accessories',
    description: 'Essential cleaner for keeping the ball surface usable and consistent between sessions.',
    shortDescription: 'Cleaner for maintaining ball surface condition.',
    fullDescription: 'Essential cleaner for keeping the ball surface usable and consistent between sessions.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'microfiber-towels',
    name: 'Microfiber Towels',
    brand: 'Shop Supply',
    category: 'bowling-ball-accessories',
    description: 'High-quality towels for quick surface cleaning, drying, and oil removal between games.',
    shortDescription: 'Quick-clean towel set for equipment care.',
    fullDescription: 'High-quality towels for quick surface cleaning, drying, and oil removal between games.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'bowling-ball-polish',
    name: 'Bowling Ball Polish',
    brand: 'Shop Supply',
    category: 'bowling-ball-accessories',
    description: 'Polish and care product for refreshing the surface and maintaining a clean, consistent finish.',
    shortDescription: 'Polish to maintain a clean finish.',
    fullDescription: 'Polish and care product for refreshing the surface and maintaining a clean, consistent finish.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'thumb-tape',
    name: 'Thumb Tape',
    brand: 'Shop Supply',
    category: 'bowling-ball-accessories',
    description: 'Protective thumb tape for a more comfortable grip and a better feel during each delivery.',
    shortDescription: 'Comfort and grip support for thumb.',
    fullDescription: 'Protective thumb tape for a more comfortable grip and a better feel during each delivery.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'finger-inserts',
    name: 'Finger Inserts',
    brand: 'Shop Supply',
    category: 'bowling-ball-accessories',
    description: 'Custom-fit inserts for players seeking more comfort, tactile feel, and grip consistency in the hand.',
    shortDescription: 'Comfort and grip support for finger holes.',
    fullDescription: 'Custom-fit inserts for players seeking more comfort, tactile feel, and grip consistency in the hand.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  },
  {
    slug: 'grip-sacks',
    name: 'Grip Sacks',
    brand: 'Shop Supply',
    category: 'bowling-ball-accessories',
    description: 'Protective grip sacks for storing and carrying equipment while keeping the surface clean and secure.',
    shortDescription: 'Protective storage and transport for bowling gear.',
    fullDescription: 'Protective grip sacks for storing and carrying equipment while keeping the surface clean and secure.',
    image: null, gallery: [], price: null, salePrice: null, priceConfirmed: false, availability: 'contact', stockQuantity: null, featured: false, isStarter: true, active: true, weights: [], pricingRule: 'contact', offers: []
  }
];

module.exports = { catalogCategories, starterProducts };