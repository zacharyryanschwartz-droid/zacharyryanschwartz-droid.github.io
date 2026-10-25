/* Market Plot — static game data & tuning knobs.
   Everything an economy designer would tweak lives here. */
'use strict';

const BASES = {
  plum:    { name: 'Plum',    noun: 'Plums',    stem: 'Plum',    join: false, color: '#8e4fc9', grow: 8,  yield: 3, value: 6 },
  berry:   { name: 'Berry',   noun: 'berry Clusters', stem: 'berry', join: true, color: '#e8a93a', grow: 6, yield: 4, value: 5 },
  beet:    { name: 'Beet',    noun: 'Beets',    stem: 'Beet',    join: false, color: '#b8336a', grow: 7,  yield: 3, value: 5 },
  root:    { name: 'Root',    noun: 'root',     stem: 'root',    join: true,  color: '#f08a3c', grow: 6,  yield: 3, value: 4 },
  wheat:   { name: 'Wheat',   noun: 'Wheat',    stem: 'Wheat',   join: false, color: '#e9c46a', grow: 5,  yield: 5, value: 3 },
  petal:   { name: 'Petal',   noun: 'petal Blooms', stem: 'petal', join: true, color: '#f7b2c8', grow: 9, yield: 3, value: 7 },
  tomato:  { name: 'Tomato',  noun: 'Tomatoes', stem: 'Tomato',  join: false, color: '#e8553f', grow: 7,  yield: 4, value: 5 },
  pumpkin: { name: 'Pumpkin', noun: 'Pumpkins', stem: 'Pumpkin', join: false, color: '#f29a2e', grow: 12, yield: 2, value: 11 },
  corn:    { name: 'Corn',    noun: 'Corn',     stem: 'Corn',    join: false, color: '#f4c542', grow: 7,  yield: 4, value: 4 },
  bean:    { name: 'Bean',    noun: 'Beans',    stem: 'Bean',    join: false, color: '#5fae45', grow: 6,  yield: 5, value: 3 },
  onion:   { name: 'Onion',   noun: 'Onions',   stem: 'Onion',   join: false, color: '#c98bd8', grow: 6,  yield: 4, value: 4 },
};

/* rarity feeds novelty: rarer traits = customers more excited */
const TRAITS = {
  sweet:   { name: 'Sweet',   prefix: 'Sugar',    tint: '#ff9ec7', sym: '♥', pattern: 'dots',   glow: false, growMul: 1.0, yieldAdd: 0,  valueMul: 1.2, rarity: 1 },
  giant:   { name: 'Giant',   prefix: 'Jumbo',    tint: null,      sym: '▲', pattern: 'none',   glow: false, growMul: 1.5, yieldAdd: 2,  valueMul: 1.3, rarity: 1, scale: 1.15 },
  spicy:   { name: 'Spicy',   prefix: 'Ember',    tint: '#ff5a36', sym: '♨', pattern: 'flame',  glow: false, growMul: 0.9, yieldAdd: 0,  valueMul: 1.25, rarity: 2 },
  moon:    { name: 'Moon',    prefix: 'Moon',     tint: '#f2c94c', sym: '☾', pattern: 'spots',  glow: false, growMul: 1.1, yieldAdd: 1,  valueMul: 1.4, rarity: 2 },
  stardew: { name: 'Stardew', prefix: 'Stardew',  tint: '#7b3fc4', sym: '★', pattern: 'stars',  glow: true,  growMul: 1.2, yieldAdd: 0,  valueMul: 1.6, rarity: 3 },
  crystal: { name: 'Crystal', prefix: 'Crystal',  tint: '#c03fa0', sym: '◆', pattern: 'facets', glow: true,  growMul: 1.3, yieldAdd: 0,  valueMul: 1.8, rarity: 4 },
  sun:     { name: 'Sun',     prefix: 'Sun',      tint: '#ffc93c', sym: '☀', pattern: 'rays',   glow: true,  growMul: 0.8, yieldAdd: 1,  valueMul: 1.5, rarity: 3 },
  plain:   { name: 'Plain',   prefix: '',         tint: null,      sym: '•', pattern: 'none',   glow: false, growMul: 1.0, yieldAdd: 0,  valueMul: 1.0, rarity: 0, hidden: true }, // basic crops only, never offered
  frost:   { name: 'Frost',   prefix: 'Frost',    tint: '#7ec8f2', sym: '❄', pattern: 'snow',   glow: true,  growMul: 1.2, yieldAdd: 0,  valueMul: 1.6, rarity: 3 },
};

/* Recipes: `uses` crops -> `out` products, each worth crop value * mult */
const RECIPES = {
  jam:     { name: 'Jam',     uses: 2, mult: 2.8, time: 8,  kind: 'jar' },
  juice:   { name: 'Juice',   uses: 2, mult: 2.4, time: 6,  kind: 'bottle' },
  pickles: { name: 'Pickles', uses: 2, mult: 3.0, time: 10, kind: 'jar' },
  pie:     { name: 'Pie',     uses: 3, mult: 5.0, time: 12, kind: 'pie' },
  cordial: { name: 'Cordial', uses: 2, mult: 4.2, time: 10, kind: 'bottle' },
  soup:    { name: 'Soup',    uses: 2, mult: 2.6, time: 8,  kind: 'bowl' },
};
const DRINK_RECIPES = ['juice', 'cordial']; // no basic tool makes these: they need an invented tool

/* TOOLS (machines) are inventions too: type 'tool', source 'basic'|'ai'.
   AI tools boost PRODUCTION: speedMult (<1 = faster) and bonusOut (extra products per batch). */
/* EXACTLY 2 basic tools at every location, owned from the start. The Cookpot can't make juices or drinks (DRINK_RECIPES). */
const TOOLS = {
  oven:    { name: 'Oven',    source: 'basic', recipes: ['pie'],                   speedMult: 1, bonusOut: 0, owned: true, desc: 'A cozy brick oven for pies, tarts and bakes.' },
  cookpot: { name: 'Cookpot', source: 'basic', recipes: ['jam', 'soup', 'pickles'], speedMult: 1, bonusOut: 0, owned: true, desc: 'Simmers jams, soups and pickles. No juices or drinks.' },
};
/* ===== CREATION SLOTS (per location) =====
   Every location has the 4 basic crops + 2 basic tools, and room for at most SLOTS invented things of each kind
   (AI-made, Free Mix Lab or Bazaar items all count). Full = delete one first; nothing is spent. */
const SLOTS = { crop: 4, tool: 4, recipe: 10 };

/* Marketing tools (global, not gated). traffic = extra customers/sec, appeal = x perceived value */
const MARKETING = {
  chalk:   { name: 'Chalkboard', emoji: '🪧', cost: 0,  dur: 0,  traffic: 0.05, appeal: 1.05, desc: 'Always-on sign', passive: true },
  bell:    { name: 'Brass Bell', emoji: '🔔', cost: 0,  burst: 3, cooldown: 20, desc: 'Ring: 3 browsers' },
  flyers:  { name: 'Flyers',     emoji: '📜', cost: 12, dur: 45, traffic: 0.25, appeal: 1.0,  desc: '+traffic 45s' },
  tasting: { name: 'Tasting',    emoji: '🥄', cost: 0,  dur: 40, traffic: 0.1,  appeal: 1.3,  desc: 'Give 1 item: +30% appeal 40s', usesItem: true },
};

/* ===== INVENTION TYPES & SOURCES (per item, no global tier) =====
   Invention types: 'crop' | 'tool' have source 'basic' | 'ai'. Crafted products inherit their crop's source.
   basic = free procedural inventor: basic crops/traits, LOWER buyer demand (pushes prices down).
   ai    = made with AI (1 AI credit; Market Plot+ grants 20 credits/week). Effect depends on type:
           crop -> higher DEMAND (inherited by goods cooked from it); tool -> higher PRODUCTION (see TOOLS).
   Remove Ads is a separate purchase and ONLY removes ads. */
const SOURCES = {
  // Every seed and trait is basic: the free inventor can combine all of them. AI is never a gate,
  // only a quality/production boost on items actually made with 'Invent with AI'.
  basic: { label: 'Basic', bases: Object.keys(BASES), traits: Object.keys(TRAITS).filter(t => !TRAITS[t].hidden) },
  ai:    { label: 'AI', bases: Object.keys(BASES), traits: Object.keys(TRAITS).filter(t => !TRAITS[t].hidden) },
};
/* DEMAND STACKING (confirmed): multipliers multiply, then one overall cap protects the economy.
   demand = Basic 0.7 × AI crop (if any AI crop ingredient) × Combo (extra distinct ingredients) × AI recipe (complexity) , ≤ cap */
const DEMAND_STACK = {
  base: 0.7,                                           // every good starts here (free/basic)
  aiCrop: 1 / 0.7, aiCropPerExtra: 0.05, aiCropMax: 1.5, // ×1.43 (= 1/0.7, so a plain AI crop is exactly ×1.0), +0.05 per extra distinct AI crop
  comboPerExtra: 0.15, comboMax: 1.3,                  // +15% per extra distinct ingredient (combos and multi-ingredient recipes)
  recipePerStar: 0.1, recipeMax: 1.5,                  // AI recipe product: 1 + 0.1·stars
  cap: 1.8,                                            // overall cap on the final multiplier
};
function demandStack({ ai = 0, extras = 0, stars = 0 } = {}) {
  const D = DEMAND_STACK, parts = [['Basic', D.base]];
  if (ai > 0) parts.push(['AI crop', Math.min(D.aiCropMax, D.aiCrop + D.aiCropPerExtra * (ai - 1))]);
  if (extras > 0) parts.push(['Combo', Math.min(D.comboMax, 1 + D.comboPerExtra * extras)]);
  if (stars > 0) parts.push(['AI recipe', Math.min(D.recipeMax, 1 + D.recipePerStar * stars)]);
  const raw = parts.reduce((a, p) => a * p[1], 1);
  return { demand: Math.round(Math.min(D.cap, raw) * 100 + 1e-6) / 100, raw: +raw.toFixed(3), capped: raw > D.cap, parts: parts.map(([l, m]) => [l, +m.toFixed(2)]) };
}
const DEMAND = { crop: { basic: DEMAND_STACK.base, ai: +(DEMAND_STACK.base * DEMAND_STACK.aiCrop).toFixed(2) } }; // plain crop shortcuts

/* ===== ECONOMY KNOBS ===== */
const ECON = {
  startCoins: 60,
  inventCost: 10,          // coins per procedural invention
  seedCost: 2,             // coins to plant a plot
  plotBaseCost: 40,        // first extra plot; each next +50%
  plotCostGrowth: 1.5,
  startPlots: 6,
  baseTraffic: 0.22,       // customers per second with no marketing
  noveltyBoost: 0.6,       // perceived value bonus at full novelty
  noveltyDecayPerSale: 0.03,
  noveltyFloor: 0.15,
  noveltyRecoverPerSec: 0.002,
  priceSensitivity: 1.6,   // exponent on willingness curve
  marketSlots: 6,
  interstitialEverySales: 12, // MONETIZATION HOOK cadence (only if Remove Ads not owned)
};

/* Starter inventions: names come from the official key art */
const STARTERS = []; // retired: fresh saves start with the 4 BASIC_CROPS only (see below)

/* ===== TOOL UPGRADES (coins only; coins are never sold for real money) =====
   Each level: processing time x speedPerLevel, and +1 product per batch at bonusLevels. */
const TOOL_UPGRADE = {
  maxLevel: 5,
  baseCost: 30,          // Lv1 -> Lv2
  costGrowth: 1.8,       // each next level costs 80% more
  speedPerLevel: 0.88,   // 12% faster per level
  bonusLevels: [3, 5],   // +1 output at Lv3 and Lv5
};
function toolUpgradeCost(level) { return Math.round(TOOL_UPGRADE.baseCost * Math.pow(TOOL_UPGRADE.costGrowth, level - 1)); }

/* ===== NEW-PLAYER GRANT =====
   1 free AI credit, granted ONCE when a new save is created (mockup: localStorage).
   Real build: tie to iCloud / Game Center / server record so reinstalls don't re-grant. */
const STARTER_AI_CREDITS = 1;

/* ===== FREE SEEDS (anti-soft-lock) =====
   One plain, low-value crop is ALWAYS free to plant, with unlimited seeds, at every location (fresh ones too).
   With 0 coins and nothing in storage the player can still: plant it -> harvest by hand -> Send to Market ->
   put it on the stall -> sell. No workers, tools, plots or other purchases are needed. */
const FREE_CROP = { id: 'tomato_free', base: 'tomato', trait: 'plain', name: 'Garden Tomatoes', stem: 'Garden Tomato', seed: 0,
  growTime: 6, yield: 4, baseValue: 3, desc: 'Plain garden tomatoes. Seeds are always free, so you can never get stuck. Low value, but they always sell.' };
/* ===== BASIC CROPS: exactly 4 at every location (fresh farms too). Can't be deleted, don't use a slot. Tomato seeds are free. */
const BASIC_CROPS = [FREE_CROP,
  { id: 'corn_basic',  base: 'corn',  trait: 'plain', name: 'Sweet Corn',  stem: 'Sweet Corn', seed: 1, growTime: 7, yield: 4, baseValue: 4, desc: 'Golden cobs, the backbone of every cozy kitchen. Cheap seeds.' },
  { id: 'bean_basic',  base: 'bean',  trait: 'plain', name: 'Green Beans', stem: 'Green Bean', seed: 1, growTime: 6, yield: 5, baseValue: 3, desc: 'Snappy green beans. Grow fast, pile up quickly. Cheap seeds.' },
  { id: 'onion_basic', base: 'onion', trait: 'plain', name: 'Onions',      stem: 'Onion',      seed: 1, growTime: 6, yield: 4, baseValue: 4, desc: 'Sweet purple onions for soups and pickles. Cheap seeds.' }];
const BASIC_CROP_IDS = BASIC_CROPS.map(b => b.id);

/* ===== HIRED WORKERS (coins only) =====
   Farmhand + Farm Manager only PLANT into empty plots (paying the normal seed cost). The Harvester only HARVESTS ripe plots
   (this location only) into the basket; the player can always harvest by hand too.
   Kitchen workers cook/craft only from harvested items already in the basket/pantry, and collect their finished batches. */
const WORKERS = {
  farmhand: { name: 'Farmhand',       area: 'farm',    hire: 40,  wage: 2, every: 4, tier: 'cheap',
              desc: 'Plants a truly random crop from this farm’s seed list (every crop type equally likely, free Garden Tomatoes included) into empty plots. Never harvests.' },
  manager:  { name: 'Farm Manager',   area: 'farm',    hire: 180, wage: 6, every: 2.5, tier: 'pro',
              desc: 'Plants what the Orders board asks for, otherwise your highest-value crop. Never harvests.' },
  harvester:{ name: 'Harvester',      area: 'farm',    hire: 120, wage: 4, every: 3, tier: 'cheap',
              desc: 'Harvests ripe plots at this location into the Farm Basket, one plot at a time. Never plants.' },
  krunner:  { name: 'Kitchen Runner', area: 'farm',    hire: 70,  wage: 3, every: 3, tier: 'cheap', runner: true,
              desc: 'Carries up to 4 crops per trip from the Farm Basket to the Kitchen Pantry, Orders board / Head Chef needs first.' },
  helper:   { name: 'Kitchen Helper', area: 'kitchen', hire: 60,  wage: 3, every: 5, tier: 'cheap',
              desc: 'Cooks a truly random dish it can make right now from the Pantry with your idle tools (every dish equally likely, learned recipes included). No favourites.' },
  chef:     { name: 'Head Chef',      area: 'kitchen', hire: 250, wage: 8, every: 3, tier: 'pro',
              desc: 'Crafts the highest-value item (combos and learned AI recipes too) and posts missing ingredients to the Orders board.' },
  mrunner:  { name: 'Market Runner',  area: 'kitchen', hire: 90,  wage: 3, every: 3, tier: 'cheap', runner: true,
              desc: 'Carries up to 4 finished goods per trip from the Kitchen Ready shelf to the Market Stockroom, stall gaps and best sellers first.' },
  market:   { name: 'Market Manager', area: 'market', hire: 200, wage: 7, every: 3, tier: 'pro',
              desc: 'Stocks empty baskets with your best goods at the best-earning price, re-prices, and uses the Bell, Flyers and Tasting when they pay off.' },
};
/* FARM MAP: unlocks when the home farm is fully upgraded (all MAX_HOME_PLOTS plot slots bought). Coins only.
   Extra farms come with a fixed number of plots (no plot buying there). Workers work across ALL farms. */
const MAX_HOME_PLOTS = 12;
/* LOGISTICS: items live in one of four places and never teleport. Harvests -> Farm Basket; the Kitchen cooks only from its
   Pantry (+ its Ready shelf for product ingredients); finished goods land on the Ready shelf; the Market sells only from its Stockroom. */
const LOCS = { basket: { name: 'Farm Basket', emoji: '🧺' }, pantry: { name: 'Kitchen Pantry', emoji: '🫙' }, ready: { name: 'Ready shelf', emoji: '🍯' }, stock: { name: 'Market Stockroom', emoji: '📦' } };
const RUNNER_LOAD = 4; // items per runner trip
const FARMS_FOR_SALE = [
  { id: 'meadow',  name: 'Meadow Hill',    emoji: '🌼', plots: 4,  price: 600,  x: 78,  y: 92,  desc: 'Breezy hilltop with wildflowers.' },
  { id: 'river',   name: 'Riverbend',      emoji: '🐟', plots: 6,  price: 1500, x: 268, y: 74,  desc: 'Rich soil where the river curls.' },
  { id: 'orchard', name: 'Sunny Orchard',  emoji: '🍎', plots: 8,  price: 3500, x: 284, y: 206, desc: 'Warm slopes lined with fruit trees.' },
  { id: 'hollow',  name: 'Pumpkin Hollow', emoji: '🎃', plots: 10, price: 8000, x: 70,  y: 222, desc: 'A sheltered valley, the biggest plot of land.' },
];
const WORKER_ECON = { wagePeriod: 30, maxOrders: 4 }; // wage charged every 30 s of play; workers stop when coins can't cover it

/* ===== AI PROMPT STUB TABLES =====
   The player types a free-text idea ("a cactus that grows tiny umbrellas"). With no network, the
   AIInterpreter stub turns it into an item DETERMINISTICALLY with keyword matching (same text -> same item).
   The real game sends the text to the AI backend (with moderation) and gets back the same data structure. */
const AI_KEYWORDS = {
  // first match wins (order matters); words are matched singular or plural
  base: {
    pumpkin: ['pumpkin', 'melon', 'watermelon', 'squash', 'gourd', 'coconut', 'boulder', 'house'],
    tomato:  ['tomato', 'apple', 'cherry', 'ruby', 'lantern', 'heart', 'balloon'],
    berry:   ['berry', 'strawberry', 'blueberry', 'grape', 'cluster', 'bead', 'pearl', 'marble', 'bubble', 'button', 'jellybean'],
    petal:   ['flower', 'petal', 'bloom', 'rose', 'tulip', 'daisy', 'lily', 'blossom', 'orchid', 'sunflower', 'butterfly'],
    corn:    ['corn', 'cob', 'maize', 'popcorn'],
    bean:    ['bean', 'pea', 'pod', 'lentil', 'edamame'],
    onion:   ['onion', 'garlic', 'shallot', 'leek', 'scallion'],
    wheat:   ['wheat', 'grain', 'cactus', 'tree', 'vine', 'stalk', 'grass', 'bamboo', 'cane', 'reed', 'noodle', 'spaghetti'],
    root:    ['root', 'carrot', 'potato', 'ginger', 'tuber', 'mandrake', 'yam', 'parsnip', 'sock'],
    beet:    ['beet', 'radish', 'turnip'],
    plum:    ['plum', 'fruit', 'peach', 'orange', 'lemon', 'orb', 'egg', 'ball', 'planet'],
  },
  trait: {
    crystal: ['crystal', 'glass', 'gem', 'diamond', 'jewel', 'prism', 'rainbow', 'geode', 'mirror'],
    frost:   ['snow', 'ice', 'icy', 'cold', 'frost', 'winter', 'frozen', 'penguin', 'mint', 'snowflake'],
    spicy:   ['spicy', 'fire', 'hot', 'pepper', 'flame', 'lava', 'dragon', 'chili', 'volcano', 'firework'],
    moon:    ['moon', 'night', 'dream', 'sleep', 'sleepy', 'owl', 'ghost', 'shadow', 'lunar', 'midnight'],
    stardew: ['star', 'sparkle', 'sparkly', 'glitter', 'magic', 'fairy', 'wish', 'comet', 'galaxy', 'space', 'cosmic', 'unicorn'],
    sweet:   ['sweet', 'candy', 'sugar', 'honey', 'chocolate', 'cake', 'dessert', 'caramel', 'syrup', 'cookie', 'marshmallow', 'cotton'],
    sun:     ['sun', 'summer', 'gold', 'golden', 'light', 'glow', 'glowing', 'umbrella', 'beach', 'sunny', 'warm', 'lamp'],
    giant:   ['giant', 'huge', 'enormous', 'big', 'massive', 'colossal', 'gigantic', 'tall'],
  },
  color: { red: '#e8553f', blue: '#4f8ff0', purple: '#9b6cf0', violet: '#9b6cf0', pink: '#f28cc0', green: '#6fbf4a',
           yellow: '#f6d04d', orange: '#f29a2e', gold: '#f2c14e', golden: '#f2c14e', white: '#f4efe6', black: '#4a3b4f',
           silver: '#c9ced6', teal: '#3fc1b0', turquoise: '#3fc1b0', rainbow: '#c06cf0', brown: '#a86a3e' },
  hue: { red: 330, pink: 300, purple: 250, violet: 250, blue: 190, teal: 150, green: 90, yellow: 30, gold: 30, golden: 30, orange: 10, rainbow: 270 },
  recipe: {
    jam:     ['jam', 'jelly', 'preserve', 'marmalade', 'spread', 'squish', 'press', 'squash', 'smash'],
    juice:   ['juice', 'juicer', 'squeeze', 'blend', 'blender', 'smoothie', 'drink', 'lemonade'],
    pickles: ['pickle', 'brine', 'ferment', 'sour', 'vinegar', 'jar'],
    pie:     ['pie', 'bake', 'oven', 'pastry', 'tart', 'cake', 'bread', 'toast', 'toaster', 'bakery'],
    cordial: ['cordial', 'distill', 'still', 'fizz', 'fizzy', 'soda', 'potion', 'tonic', 'brew', 'sparkling', 'cauldron'],
    soup:    ['soup', 'stew', 'broth', 'chowder', 'chili', 'ladle', 'kettle'],
  },
  // words skipped when building the item's name
  stop: ['a', 'an', 'the', 'that', 'which', 'who', 'with', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'at', 'from', 'by', 'into', 'like',
         'is', 'are', 'it', 'its', 'can', 'will', 'be', 'i', 'my', 'me', 'want', 'some', 'very', 'really', 'super', 'so', 'as', 'than',
         'tiny', 'little', 'small', 'mini', 'giant', 'huge', 'big', 'glowing', 'magic', 'magical', 'crazy', 'weird',
         'grow', 'grows', 'growing', 'make', 'makes', 'making', 'made', 'full', 'plant', 'plants', 'seed', 'seeds', 'crop', 'crops',
         'taste', 'tastes', 'tasting', 'smell', 'smells', 'look', 'looks', 'turn', 'turns', 'rain', 'rains', 'sing', 'sings', 'when', 'you',
         'fast', 'faster', 'quick', 'quickly', 'twice', 'double', 'triple', 'extra', 'more', 'machine', 'tool', 'thing', 'kind', 'sort'],
  blocked: ['kill', 'gun', 'blood', 'drug', 'nazi', 'bomb', 'weapon', 'murder', 'porn', 'sex', 'nude', 'naked', 'gore', 'hate',
    'disney', 'mickey', 'pokemon', 'pikachu', 'nintendo', 'mario', 'marvel', 'coca', 'nike', 'mcdonald', 'starbucks', 'iphone', 'potter'], // moderation stub (the server has the full list + model check)
  toolAdj: ['Whirly', 'Turbo', 'Dreamy', 'Clockwork', 'Bubbly', 'Starlit', 'Humming', 'Cozy'],
};
const AI_PROMPT_EXAMPLES = {
  crop: ['a cactus that grows tiny umbrellas', 'strawberries that taste like cotton candy', 'blue pumpkins full of snow', 'a flower that sings at midnight'],
  tool: ['a cloud that rains jam', 'a dragon oven that bakes pies', 'a fizzy potion cauldron', 'a robot blender with two arms'],
  recipe: ['umbrella cactus jam tarts with sparkle frosting', 'plum pie with moonberry cream', 'frosty pickle sandwich', 'fizzy berry soda'],
};
/* AI RECIPES: free text -> a structured multi-step recipe using tools the player owns/can buy and
   ingredients they have invented. Complexity (stars) drives steps, ingredients, craft time, price and demand. */
const RECIPE_STEP_WORDS = { // tool -> [action, keywords]
  oven: ['Bake', ['bake', 'baked', 'tart', 'pie', 'cake', 'bread', 'cookie', 'muffin', 'pastry', 'crust', 'roast', 'toast', 'bun', 'pizza', 'sandwich', 'waffle']],
  cookpot: ['Simmer', ['jam', 'boil', 'soup', 'stew', 'sauce', 'simmer', 'compote', 'syrup', 'caramel', 'cream', 'custard', 'whip', 'mash', 'pickle', 'pickled', 'brine', 'relish', 'chutney', 'frosting', 'icing', 'glaze']],
};
const RECIPE_FORM_WORDS = { pie: ['tart', 'pie', 'cake', 'pastry', 'muffin', 'cookie', 'bread', 'bun', 'sandwich', 'waffle', 'pizza', 'doughnut', 'donut', 'fritter', 'churro'], cordial: ['soda', 'drink', 'potion', 'tonic', 'elixir', 'cordial', 'smoothie'], pickles: ['pickle', 'kimchi', 'relish'] };
/* COMBINING (free, non-AI): add 1-2 extra distinct ingredients (crops or products, 1 unit each) to a batch */
/* RECIPE REQUIREMENTS (offline stub): produce / tools a dish needs that may not exist yet. The real server's model decides
   these freely; the stub uses these word lists. Matched as whole words, and produce also as a word prefix ("cornbread" -> Corn). */
const REQ_PRODUCE = { corn: 'Corn', jalapeno: 'Jalapeno', chili: 'Chili', pepper: 'Pepper', apple: 'Apple', lemon: 'Lemon', lime: 'Lime', orange: 'Orange',
  banana: 'Banana', strawberry: 'Strawberry', blueberry: 'Blueberry', raspberry: 'Raspberry', cherry: 'Cherry', peach: 'Peach', mango: 'Mango',
  pineapple: 'Pineapple', coconut: 'Coconut', carrot: 'Carrot', potato: 'Potato', onion: 'Onion', garlic: 'Garlic', basil: 'Basil', mint: 'Mint',
  cucumber: 'Cucumber', pea: 'Pea', bean: 'Bean', cocoa: 'Cocoa', coffee: 'Coffee', vanilla: 'Vanilla', rhubarb: 'Rhubarb', fig: 'Fig', grape: 'Grape' };
const REQ_TOOLS = { // name -> [action, keywords, idea]
  'Juice Press': ['Press', ['juice', 'juicer', 'smoothie', 'soda', 'drink', 'lemonade', 'cordial', 'fizzy', 'fizz', 'potion', 'tonic', 'elixir', 'sparkling', 'blend', 'blender'], 'a cheerful juice press that squeezes fruit into fizzy drinks'],
  'Mixer': ['Mix', ['doughnut', 'donut', 'dough', 'batter', 'whisk', 'churro', 'fritter'], 'a chunky stand mixer that kneads dough with a happy whirr'],
  'Deep Fryer': ['Fry', ['doughnut', 'donut', 'fry', 'fried', 'fritter', 'churro', 'tempura', 'crispy'], 'a bubbling deep fryer that turns dough golden'],
  'Grill': ['Grill', ['grill', 'grilled', 'bbq', 'barbecue', 'skewer', 'kebab', 'charred'], 'a cozy little garden grill'],
  'Ice Cream Churn': ['Churn', ['icecream', 'gelato', 'sorbet', 'frozen', 'freeze', 'popsicle', 'sundae'], 'a hand-cranked ice cream churn'],
  'Waffle Iron': ['Press', ['waffle'], 'a heart-shaped waffle iron'],
  'Smoker': ['Smoke', ['smoked', 'smoky', 'smoke'], 'a chubby wood smoker'],
  'Pasta Press': ['Press', ['pasta', 'noodle', 'ravioli', 'spaghetti'], 'a crank pasta press'],
};
const PANTRY_STAPLES = ['milk', 'butter', 'cream', 'cheese', 'egg', 'sugar', 'flour', 'salt', 'oil', 'honey', 'yeast']; // always stocked, never required
const COMBO = { maxExtras: 2, extraValueMult: 1.0 }; // demand bonus lives in DEMAND_STACK.comboPerExtra / comboMax
const RECIPE_CAPS = { maxStars: 5, maxValue: 400, maxDemand: 1.8, maxSteps: 4, maxIngredients: 4 }; // the server clamps to these
const AI_CROP_VALUE_BONUS = 1.2; // AI-quality crop stats
const AI_CROP_MIN_VALUE = 12;    // AI crops are never bargain-bin, whatever base shape the prompt maps to

/* ======================================================================================
   THINK IT, SELL IT! — core-identity tables (customers, trends, chemistry, Bazaar)
   ====================================================================================== */
/* Named townsfolk. likes/dislikes are item TAGS (see TAG_RULES). haggle = chance they counter-offer. */
const CUSTOMERS = {
  pam:   { name: 'Picky Pam',      look: { skin: '#f6d1b1', shirt: '#8e5bd1', hair: '#6b4a2b', acc: 'glasses', hat: 'bun' },  likes: ['crystal', 'flower', 'frosty', 'fancy'], dislikes: ['spicy', 'giant', 'weird', 'savory'], bias: -0.5, curious: -0.4, haggle: 0.18 },
  ollie: { name: 'Grandpa Ollie',  look: { skin: '#e0a982', shirt: '#6f8f4a', hair: '#e9e9e9', acc: 'mustache', hat: 'cap' }, likes: ['breakfast', 'savory', 'veggie', 'classic'], dislikes: ['glowing', 'weird', 'ai'], bias: 0.2, curious: -0.6, haggle: 0.35 },
  tia:   { name: 'Trendy Tia',     look: { skin: '#b07a52', shirt: '#e86fa6', hair: '#ff7ac8', acc: 'shades', hat: 'none' },   likes: ['trend', 'glowing', 'tiny', 'ai', 'weird'], dislikes: ['veggie', 'classic', 'savory'], bias: 0, curious: 0.5, haggle: 0.08 },
  max:   { name: 'Kid Max',        look: { skin: '#f2c7a0', shirt: '#5aa9e6', hair: '#8a5a2b', acc: 'none', hat: 'propeller' }, likes: ['dessert', 'sweet', 'glowing', 'giant', 'spooky', 'weird'], dislikes: ['veggie', 'savory', 'spicy', 'flower'], bias: 0.3, curious: 0.7, haggle: 0.25 },
  rosa:  { name: 'Chef Rosa',      look: { skin: '#7a4e33', shirt: '#ffffff', hair: '#2b1a10', acc: 'none', hat: 'chef' },     likes: ['combo', 'spicy', 'savory', 'drink', 'fruit'], dislikes: ['tiny', 'plain'], bias: -0.2, curious: 0.3, haggle: 0.2 },
  fig:   { name: 'Professor Fig',  look: { skin: '#f6d1b1', shirt: '#4a6fa5', hair: '#bfbfbf', acc: 'bowtie', hat: 'none' },   likes: ['weird', 'crystal', 'ai', 'combo', 'glowing'], dislikes: [], bias: 0, curious: 1, haggle: 0.1 },
};
/* tag detection: words in the item's name / description / player prompt / AI tags, plus seed, trait and recipe */
const TAG_RULES = {
  spooky: /ghost|spook|haunt|\bbats?\b|witch|moon|night|skull|zombie|pumpkin|shadow|creep|hallow|vampire|cobweb|midnight|eerie/,
  breakfast: /breakfast|pancake|waffle|toast|cereal|\begg|bacon|muffin|porridge|\boat|bagel|coffee|morning|syrup|wheat|sunrise|brunch/,
  glowing: /glow|shine|shimmer|sparkl|neon|lumin|\bstars?\b|stardew|stardust|radiant|firefly|sunbeam|twinkl|light-?up/,
  tiny: /tiny|\bmini|little|micro|\bbite|pocket|petite|teeny|wee\b|baby/,
  dessert: /cake|\bpie|tart|cookie|candy|dessert|cream|sugar|frosting|donut|doughnut|cupcake|pudding|\bjam\b|honey|choco|caramel|sweet/,
  sweet: /sweet|sugar|honey|candy|syrup|\bjam\b/,
  spicy: /spic|\bhot\b|chili|pepper|jalape|fire|flame|dragon|ember|heat/,
  frosty: /frost|\bice|snow|cold|chill|freez|winter/,
  savory: /pickle|soup|cheese|savou?ry|salt|onion|garlic|bread|stew/,
  fruit: /berr|plum|apple|fruit|melon|grape|cherry|peach|lemon|orange|mango/,
  veggie: /beet|\broot|carrot|veg|potato|turnip|radish|\bbean|\bpea\b|corn|cabbage|lettuce|tomato/,
  flower: /petal|flower|rose|blossom|bloom|lavender|daisy/,
  crystal: /crystal|\bgem|jewel|diamond|glass|chime|prism/,
  giant: /giant|huge|mega|jumbo|enormous|colossal/,
  drink: /cordial|juice|soda|\btea\b|drink|lemonade|smoothie|fizz|potion/,
  weird: /weird|strange|talk|whisper|sing|danc|umbrella|cactus|robot|cloud|rainbow|sock|wiggl|giggl|bounc|invisible|backwards|upside|square|tickl|burp|sneez|cotton/,
};
const TRAIT_TAGS = { plain: [], sweet: ['sweet', 'dessert'], giant: ['giant'], spicy: ['spicy'], moon: ['spooky'], stardew: ['glowing'], crystal: ['crystal', 'fancy'], sun: ['glowing', 'breakfast'], frost: ['frosty'] };
const BASE_TAGS = { plum: ['fruit'], berry: ['fruit'], beet: ['veggie'], root: ['veggie'], wheat: ['breakfast'], petal: ['flower'], tomato: ['veggie', 'savory'], pumpkin: ['veggie', 'spooky'], corn: ['veggie', 'breakfast'], bean: ['veggie', 'savory'], onion: ['veggie', 'savory'] };
const RECIPE_TAGS = { jam: ['sweet', 'breakfast'], juice: ['drink'], pickles: ['savory'], pie: ['dessert'], cordial: ['drink', 'fancy'], soup: ['savory'] };
const TAG_WORD = { spooky: 'spooky', breakfast: 'breakfast-y', glowing: 'glowing', tiny: 'tiny', dessert: 'sugary', sweet: 'sweet', spicy: 'spicy', frosty: 'frosty', savory: 'savory', fruit: 'fruity', veggie: 'veggie', flower: 'flowery', crystal: 'sparkly', giant: 'giant', drink: 'drinkable', weird: 'weird', fancy: 'fancy', classic: 'classic' };

/* Weekly trends (Town Board). Week N uses TRENDS[(N-1) % length]. Matching = any listed tag. */
const TRENDS = [
  { id: 'glow', name: 'Glowing Things', emoji: '✨', tags: ['glowing'], blurb: 'The town wants anything that shines in the dark.', prompts: ['a pie that glows like a nightlight', 'firefly lemon cordial', 'a berry that twinkles when you smile'] },
  { id: 'spooky', name: 'Spooky Snacks', emoji: '👻', tags: ['spooky'], blurb: 'Harvest-moon season: creepy-cute treats sell out.', prompts: ['a pumpkin that whispers ghost stories', 'bat-wing plum tarts', 'midnight beet jam'] },
  { id: 'breakfast', name: 'Breakfast Weirdness', emoji: '🥞', tags: ['breakfast'], blurb: 'Brunch crowd wants the strangest breakfast in town.', prompts: ['pancake trees that grow syrup', 'a waffle-shaped watermelon', 'sunrise toast jam'] },
  { id: 'tiny', name: 'Tiny Desserts', emoji: '🧁', tags: ['tiny'], blurb: 'Bite-size everything. The tinier, the better.', prompts: ['pocket-size pumpkin pies', 'tiny berries for tiny tarts', 'a mini cake that fits on a thumb'] },
  { id: 'frosty', name: 'Frosty Treats', emoji: '❄️', tags: ['frosty'], blurb: 'A heatwave! Cold, icy, chilly goods fly off the stall.', prompts: ['snow plums that never melt', 'an ice-cream beet', 'frozen petal cordial'] },
  { id: 'heat', name: 'Sweet Heat', emoji: '🌶️', tags: ['spicy'], blurb: 'Spicy food festival: bring the fire.', prompts: ['a jalapeno that tastes like candy', 'dragon-breath berry jam', 'ember pumpkin pie'] },
];
const TREND_RULES = { demandBonus: 1.3, weekMs: 7 * 24 * 3600 * 1000 };
/* Weekly contest: score = buzz + ratings + sales + trend match (0..100). Prizes are coins + cosmetics only. */
const CONTEST = {
  weights: { buzz: 40, ratings: 10, sales: 25, trend: 25 }, salesFull: 10, ratingsFull: 10,
  prizes: [{ place: 1, coins: 250, award: '🏆', label: 'Gold Trophy' }, { place: 2, coins: 120, award: '🥈', label: 'Silver Ribbon' },
           { place: 3, coins: 60, award: '🥉', label: 'Bronze Ribbon' }, { place: 99, coins: 15, award: '🎗️', label: 'Participation Ribbon' }],
  rivals: ['sample: FarmerJo', 'sample: BakerBo', 'sample: AuntieMo', 'sample: Sprout42'],
};
/* Hidden chemistry for kitchen combos. Pair values across DIFFERENT ingredients: + = surprise hit, - = flop. */
const CHEMISTRY = {
  'spicy+sweet': 2, 'dessert+spicy': 1.5, 'dessert+spooky': 1.5, 'drink+glowing': 2, 'breakfast+spooky': 1.5, 'frosty+spicy': 1.5,
  'giant+tiny': 2, 'crystal+drink': 1, 'dessert+flower': 1, 'dessert+fruit': 1, 'breakfast+dessert': 1, 'fruit+glowing': 1, 'frosty+fruit': 1,
  'dessert+veggie': -1.5, 'dessert+savory': -1.5, 'drink+savory': -2, 'flower+savory': -1.5, 'crystal+savory': -1, 'drink+veggie': -1,
  'flower+spooky': -1, 'drink+spicy': -1.5, 'savory+sweet': -1, 'breakfast+spicy': -1, 'frosty+savory': -1,
};
const CHEM_RULES = { hitBase: 0.06, hitPerChem: 0.11, flopBase: 0.05, flopPerChem: 0.12, perOdd: 0.035, maxP: 0.6,
  hitDemand: 1.6, flopDemand: 0.45, flopCoins: 12, hitXP: 30, flopXP: 15, investXP: 10 };

/* ===== BAZAAR (shared invention market) — every anti-abuse / economy knob in ONE place =====
   The server (server/server.js) reads this same block, so client and server enforce identical limits. */
const BAZAAR_RULES = {
  // voting
  voteMinLevel: 2,            // Inventor level needed to vote (spam/alt-account friction); level = 1 + floor(sqrt(xp / 20))
  oneVotePerItem: true,       // a player has ONE vote per item (+1 or -1); voting again changes it, never stacks
  noSelfVote: true,           // creators cannot vote on their own items
  voteHalfLifeDays: 7,        // each vote's weight halves every week, so old hits fade
  // rank -> market-wide demand (crops only)
  rankBonusMax: 0.30,         // at most +30% demand from Bazaar rank
  rankPenaltyMax: 0.10,       // at most -10% for heavily downvoted crops
  rankBonusK: 0.075,          // bonus = min(max, K * ln(1 + score)) : diminishing (log) curve
  minVotesForBonus: 3,        // needs at least 3 distinct voters before rank affects demand
  // seed packets
  seedPriceBands: [           // creator's asking price is clamped into the band for the item's current rank tier
    { tier: 'Top 10%', topPct: 0.10, min: 30, max: 80 },
    { tier: 'Top 50%', topPct: 0.50, min: 15, max: 50 },
    { tier: 'New / unranked', topPct: 1.00, min: 8, max: 30 },
  ],
  buysPerPlayerPerDay: 5,     // seed packets / recipe cards / tool plans one player can buy per day (all items)
  stockPerItemPerWeek: 20,    // packets each item can sell per week (restocks weekly)
  royaltyRate: 0.5,           // creator earns 50% of the price as coins…
  royaltyCapPerDay: 150,      // …but at most 150 coins per day across all their items
  buyerGetsAIBonus: false,    // a bought crop is planted as a BASIC crop for the buyer: the creator's AI-quality
                              // demand bonus does not transfer; only the market-wide rank bonus applies (equally to everyone)
  maxPublishedPerPlayer: 30, pitchMax: 80,
};
const BAZAAR_SAMPLES = [ // clearly labelled sample players, seeded into a fresh Bazaar
  { id: 's1', kind: 'crop', creator: 'sample: FarmerJo', name: 'Moonbeam Muffin Berries', desc: 'Berries that taste like blueberry muffins and glow softly after dusk.', pitch: 'Breakfast that doubles as a nightlight!', price: 30,
    payload: { base: 'berry', trait: 'moon', name: 'Moonbeam Muffin Berries', stem: 'Muffin Berry', color: '#6c7bd9', growTime: 7, yield: 4, baseValue: 8, tags: ['breakfast', 'glowing'] }, votes: 14, down: 2 },
  { id: 's2', kind: 'crop', creator: 'sample: TinyTam', name: 'Pocket Pumpkins', desc: 'Thumb-size pumpkins. Forty of them fit in a teacup.', pitch: 'Tiny pies, zero effort.', price: 25,
    payload: { base: 'pumpkin', trait: 'sweet', name: 'Pocket Pumpkins', stem: 'Pocket Pumpkin', color: '#f2a640', growTime: 9, yield: 4, baseValue: 9, tags: ['tiny', 'dessert'] }, votes: 9, down: 1 },
  { id: 's3', kind: 'crop', creator: 'sample: Sprout42', name: 'Frostfire Peppers', desc: 'Ice-cold on the outside, a little fiery in the middle.', pitch: 'Hot AND cold. Customers scream (happily).', price: 22,
    payload: { base: 'tomato', trait: 'frost', name: 'Frostfire Peppers', stem: 'Frostfire Pepper', color: '#5fb6e8', growTime: 8, yield: 3, baseValue: 8, tags: ['spicy', 'frosty'] }, votes: 6, down: 3 },
  { id: 's4', kind: 'crop', creator: 'sample: AuntieMo', name: 'Grumpy Turnips', desc: 'They sigh loudly when harvested. Surprisingly tasty roasted.', pitch: 'Weird but honest.', price: 10,
    payload: { base: 'root', trait: 'giant', name: 'Grumpy Turnips', stem: 'Grumpy Turnip', color: '#c9a0dc', growTime: 6, yield: 4, baseValue: 6, tags: ['weird', 'veggie'] }, votes: 2, down: 5 },
  { id: 's5', kind: 'recipe', creator: 'sample: BakerBo', name: 'Ghost Toast Jam', desc: 'A pale plum jam that makes toast look haunted.', pitch: 'Spooky breakfast for the whole family.', price: 35,
    payload: { form: 'jam', stars: 2, ingredients: [{ name: 'Plum', qty: 3 }, { name: 'Beet', qty: 1 }], steps: [{ tool: 'Cookpot', action: 'Simmer' }], value: 34, craftTime: 14, tags: ['spooky', 'breakfast'] }, votes: 11, down: 1 },
  { id: 's6', kind: 'tool', creator: 'sample: PipTheBaker', name: 'Whistling Kettle Oven', desc: 'Sings when the pie is done. Bakes a little faster.', pitch: 'Never burn a pie again.', price: 45,
    payload: { recipes: ['pie', 'cordial'], art: 'oven', hue: 18, speedMult: 0.8, bonusOut: 0 }, votes: 7, down: 0 },
];

/* ===== IMAGE LIBRARY (internal, never shown to players) =====
   Every AI image made for any player is kept in one shared server-side library (kind, idea, name, keywords, image URL).
   When a new crop / tool / recipe is invented, the cheap text call still runs (the player always pays 1 credit and gets
   their own name, description and stats), but if a same-kind library entry is similar enough, its image is reused and the
   image model is not called (~$0.04 saved). Otherwise a new image is generated and added to the library. */
const IMAGE_LIBRARY_RULES = {
  matchMin: 0.7,      // TUNABLE: similarity (0..1) needed to reuse a stored image instead of generating one
  imageUsd: 0.04,     // estimated cost of one avoided image call (grok-imagine-image-2.0), for the savings log
  maxEntries: 20000,
};

/* ===== BEST CREATIONS (Workshop ranking). Each part is scaled 0..1 against the leader in the current view (location or all),
   stars count fully after `starsFull` ratings (fewer ratings pull toward 0 so one 5★ review can't top the chart). */
const BEST_RULES = {
  weights: { earned: 35, sold: 20, stars: 25, buzz: 20 }, // Overall score out of 100
  starsFull: 5,       // ratings needed before the star part counts fully
  buzzFull: 6,        // reactions needed before buzz counts fully (buzz = recent star average × volume)
  minRatingsForBest: 2, // "Best Rated" tab lists items with at least this many ratings
  show: 20,
};
