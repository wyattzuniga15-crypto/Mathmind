'use strict';
// ---------------------------------------------------------------- block & item registry

// render types
const RT_SOLID = 0, RT_CROSS = 1, RT_WATER = 2, RT_LEAVES = 3, RT_TORCH = 4, RT_CACTUS = 5, RT_HALF = 6;

// tool types
const T_NONE = 0, T_PICK = 1, T_AXE = 2, T_SHOVEL = 3, T_SWORD = 4, T_HOE = 5;

// Block registry. tiles: [top, bottom, side] atlas tile indices (filled by atlas builder)
const B = {}; // name -> id
const Blocks = []; // id -> def
function defBlock(id, name, opts) {
  B[name] = id;
  Blocks[id] = Object.assign({
    id, name, label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    solid: true, opaque: true, rt: RT_SOLID,
    hardness: 1,        // seconds with bare hand
    tool: T_NONE,       // best tool
    needsTool: 0,       // min tool tier required to drop (0 none,1 wood,2 stone,3 iron)
    drops: null,        // fn or [id,count] — default drop self
    tiles: null, light: 0, flammable: false,
  }, opts);
}

defBlock(0,  'air', { solid:false, opaque:false, hardness:0 });
defBlock(1,  'grass_block', { hardness:0.9, tool:T_SHOVEL, drops:['dirt',1] });
defBlock(2,  'dirt', { hardness:0.75, tool:T_SHOVEL });
defBlock(3,  'stone', { hardness:7.5, tool:T_PICK, needsTool:1, drops:['cobblestone',1] });
defBlock(4,  'cobblestone', { hardness:10, tool:T_PICK, needsTool:1 });
defBlock(5,  'bedrock', { hardness:-1 });
defBlock(6,  'sand', { hardness:0.75, tool:T_SHOVEL, gravity:true });
defBlock(7,  'gravel', { hardness:0.9, tool:T_SHOVEL, gravity:true,
  drops:() => Math.random() < 0.25 ? ['flint',1] : ['gravel',1] });
defBlock(8,  'oak_log', { hardness:3, tool:T_AXE, flammable:true });
defBlock(9,  'oak_leaves', { hardness:0.3, rt:RT_LEAVES, opaque:false, flammable:true,
  drops:() => Math.random() < 0.08 ? ['oak_sapling',1] : (Math.random() < 0.05 ? ['apple',1] : null) });
defBlock(10, 'oak_planks', { hardness:3, tool:T_AXE, flammable:true });
defBlock(11, 'water', { solid:false, opaque:false, rt:RT_WATER, hardness:-1 });
defBlock(12, 'glass', { hardness:0.45, opaque:false, drops:()=>null });
defBlock(13, 'coal_ore', { hardness:15, tool:T_PICK, needsTool:1, drops:['coal',1] });
defBlock(14, 'iron_ore', { hardness:15, tool:T_PICK, needsTool:2 });
defBlock(15, 'gold_ore', { hardness:15, tool:T_PICK, needsTool:3 });
defBlock(16, 'diamond_ore', { hardness:15, tool:T_PICK, needsTool:3, drops:['diamond',1] });
defBlock(17, 'crafting_table', { hardness:3.75, tool:T_AXE, flammable:true });
defBlock(18, 'furnace', { hardness:17.5, tool:T_PICK, needsTool:1 });
defBlock(19, 'furnace_lit', { hardness:17.5, tool:T_PICK, needsTool:1, drops:['furnace',1], light:0.9 });
defBlock(20, 'torch', { solid:false, opaque:false, rt:RT_TORCH, hardness:0.05, light:1 });
defBlock(21, 'snowy_grass', { hardness:0.9, tool:T_SHOVEL, drops:['dirt',1] });
defBlock(22, 'snow_block', { hardness:0.3, tool:T_SHOVEL });
defBlock(23, 'cactus', { hardness:0.6, rt:RT_CACTUS, opaque:false, hurts:true });
defBlock(24, 'sandstone', { hardness:4, tool:T_PICK, needsTool:1 });
defBlock(25, 'birch_log', { hardness:3, tool:T_AXE, flammable:true, drops:['oak_log',1] });
defBlock(26, 'spruce_log', { hardness:3, tool:T_AXE, flammable:true, drops:['oak_log',1] });
defBlock(27, 'spruce_leaves', { hardness:0.3, rt:RT_LEAVES, opaque:false, flammable:true, drops:()=>null });
defBlock(28, 'dandelion', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02 });
defBlock(29, 'poppy', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02 });
defBlock(30, 'tall_grass', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02,
  drops:() => Math.random() < 0.2 ? ['wheat_seeds',1] : null });
defBlock(31, 'oak_sapling', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02 });
defBlock(32, 'obsidian', { hardness:250, tool:T_PICK, needsTool:3 });
defBlock(33, 'mossy_cobblestone', { hardness:10, tool:T_PICK, needsTool:1 });
defBlock(34, 'oak_wood_top', { hardness:3, tool:T_AXE }); // internal (log tops reuse)
defBlock(35, 'farmland', { hardness:0.9, tool:T_SHOVEL, drops:['dirt',1] });
defBlock(36, 'wheat_crop', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02,
  drops:['wheat',1] });
defBlock(37, 'bookshelf', { hardness:2.25, tool:T_AXE, flammable:true, drops:['oak_planks',3] });
defBlock(38, 'brick_block', { hardness:10, tool:T_PICK, needsTool:1 });
defBlock(39, 'stone_bricks', { hardness:7.5, tool:T_PICK, needsTool:1 });
defBlock(40, 'lava', { solid:false, opaque:false, rt:RT_WATER, hardness:-1, light:1, hurts:true });
defBlock(41, 'ice', { hardness:0.75, tool:T_PICK, opaque:false, drops:()=>null, slippery:true });
defBlock(42, 'pumpkin', { hardness:1.5, tool:T_AXE });
defBlock(43, 'red_mushroom', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02 });
defBlock(44, 'brown_mushroom', { solid:false, opaque:false, rt:RT_CROSS, hardness:0.02 });
defBlock(45, 'chest', { hardness:3.75, tool:T_AXE, flammable:true });
defBlock(46, 'wool', { hardness:1.2, flammable:true });
defBlock(47, 'bed', { hardness:0.3, rt:RT_HALF, opaque:false, height:0.5 });
defBlock(48, 'stone_slab', { hardness:10, tool:T_PICK, needsTool:1, rt:RT_HALF, opaque:false, height:0.5 });
defBlock(49, 'oak_slab', { hardness:3, tool:T_AXE, flammable:true, rt:RT_HALF, opaque:false, height:0.5 });
defBlock(50, 'tnt', { hardness:0.1 });

// ---------------------------------------------------------------- items (ids >= 256)
const I = {}; // name -> id
const Items = {}; // id -> def
let _itemId = 256;
function defItem(name, opts) {
  const id = _itemId++;
  I[name] = id;
  Items[id] = Object.assign({
    id, name, label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    stack: 64, tool: T_NONE, tier: 0, speed: 1, dmg: 1, food: 0, durability: 0, icon: null,
  }, opts);
  return id;
}
// block items share the block id; item defs only for non-blocks
defItem('stick', {});
defItem('coal', {});
defItem('charcoal', {});
defItem('iron_ingot', {});
defItem('gold_ingot', {});
defItem('diamond', {});
defItem('apple', { food: 4 });
defItem('bread', { food: 5 });
defItem('wheat', {});
defItem('wheat_seeds', {});
defItem('porkchop', { food: 3 });
defItem('cooked_porkchop', { food: 8 });
defItem('beef', { food: 3 });
defItem('steak', { food: 8 });
defItem('chicken', { food: 2 });
defItem('cooked_chicken', { food: 6 });
defItem('rotten_flesh', { food: 2, rotten: true });
defItem('bone', {});
defItem('arrow', {});
defItem('string', {});
defItem('gunpowder', {});
defItem('leather', {});
defItem('feather', {});
defItem('flint', {});
defItem('egg', { stack: 16 });
defItem('bow', { stack: 1, durability: 96, dmg: 1 });

const TOOL_TIERS = [
  ['wooden', 1, 4, 60, 1],   // prefix, tier, speed, durability, bonus dmg
  ['stone', 2, 8, 132, 2],
  ['iron', 3, 12, 251, 3],
  ['golden', 1, 24, 33, 1],
  ['diamond', 4, 16, 1562, 4],
];
for (const [pre, tier, speed, dur, dmg] of TOOL_TIERS) {
  defItem(pre + '_pickaxe', { tool: T_PICK, tier, speed, durability: dur, stack: 1, dmg: 2 + dmg });
  defItem(pre + '_axe', { tool: T_AXE, tier, speed, durability: dur, stack: 1, dmg: 3 + dmg });
  defItem(pre + '_shovel', { tool: T_SHOVEL, tier, speed, durability: dur, stack: 1, dmg: 1 + dmg });
  defItem(pre + '_sword', { tool: T_SWORD, tier, speed: 1.5, durability: dur, stack: 1, dmg: 4 + dmg });
}

function itemDef(id) { return id < 256 ? Blocks[id] : Items[id]; }
function itemLabel(id) { const d = itemDef(id); return d ? d.label : '?'; }
function maxStack(id) { return id < 256 ? 64 : (Items[id].stack || 64); }

// ---------------------------------------------------------------- crafting recipes
// shaped: pattern rows of names (null = empty), normalized to top-left
// shapeless: array of names
const Recipes = [];
function recipe(out, count, pattern, shapeless) {
  Recipes.push({ out, count, pattern: pattern || null, shapeless: shapeless || null });
}
const P = null;
recipe('oak_planks', 4, null, ['oak_log']);
recipe('stick', 4, [['oak_planks'], ['oak_planks']]);
recipe('crafting_table', 1, [['oak_planks','oak_planks'],['oak_planks','oak_planks']]);
recipe('torch', 4, [['coal'],['stick']]);
recipe('torch', 4, [['charcoal'],['stick']]);
recipe('furnace', 1, [['cobblestone','cobblestone','cobblestone'],['cobblestone',P,'cobblestone'],['cobblestone','cobblestone','cobblestone']]);
recipe('chest', 1, [['oak_planks','oak_planks','oak_planks'],['oak_planks',P,'oak_planks'],['oak_planks','oak_planks','oak_planks']]);
recipe('bread', 1, [['wheat','wheat','wheat']]);
recipe('glass', 1, null, null); // placeholder removed below
Recipes.pop();
recipe('bookshelf', 1, [['oak_planks','oak_planks','oak_planks'],['wheat','wheat','wheat'],['oak_planks','oak_planks','oak_planks']]);
recipe('stone_bricks', 4, [['stone','stone'],['stone','stone']]);
recipe('sandstone', 1, [['sand','sand'],['sand','sand']]);
recipe('wool', 1, [['string','string'],['string','string']]);
recipe('stone_slab', 6, [['stone','stone','stone']]);
recipe('oak_slab', 6, [['oak_planks','oak_planks','oak_planks']]);
recipe('bed', 1, [['wool','wool','wool'],['oak_planks','oak_planks','oak_planks']]);
recipe('bow', 1, [[P,'stick','string'],['stick',P,'string'],[P,'stick','string']]);
recipe('arrow', 4, [['flint'],['stick'],['feather']]);
recipe('tnt', 1, [['gunpowder','sand','gunpowder'],['sand','gunpowder','sand'],['gunpowder','sand','gunpowder']]);
recipe('snow_block', 1, [['snow_block']]); // no-op safeguard
Recipes.pop();
for (const [pre] of TOOL_TIERS) {
  const mat = { wooden:'oak_planks', stone:'cobblestone', iron:'iron_ingot', golden:'gold_ingot', diamond:'diamond' }[pre];
  recipe(pre + '_pickaxe', 1, [[mat,mat,mat],[P,'stick',P],[P,'stick',P]]);
  recipe(pre + '_axe', 1, [[mat,mat],[mat,'stick'],[P,'stick']]);
  recipe(pre + '_shovel', 1, [[mat],['stick'],['stick']]);
  recipe(pre + '_sword', 1, [[mat],[mat],['stick']]);
}
// resolve names -> ids once everything is defined
function nameToId(n) {
  if (n == null) return 0;
  if (B[n] !== undefined) return B[n];
  if (I[n] !== undefined) return I[n];
  console.warn('unknown recipe item', n);
  return 0;
}
for (const r of Recipes) {
  r.outId = nameToId(r.out);
  if (r.pattern) r.pat = r.pattern.map(row => row.map(nameToId));
  if (r.shapeless) r.ids = r.shapeless.map(nameToId).sort((a, b) => a - b);
}

// smelting: input id -> [output id, output count]
const Smelting = {};
function smelt(inp, out) { Smelting[nameToId(inp)] = nameToId(out); }
smelt('iron_ore', 'iron_ingot');
smelt('gold_ore', 'gold_ingot');
smelt('sand', 'glass');
smelt('cobblestone', 'stone');
smelt('oak_log', 'charcoal');
smelt('porkchop', 'cooked_porkchop');
smelt('beef', 'steak');
smelt('chicken', 'cooked_chicken');

// fuel burn time in seconds (one smelt = 10s)
function fuelTime(id) {
  if (id === nameToId('coal') || id === nameToId('charcoal')) return 80;
  if (id === B.oak_planks || id === B.crafting_table || id === B.chest || id === B.bookshelf) return 15;
  if (id === B.oak_log || id === B.birch_log || id === B.spruce_log) return 15;
  if (id === I.stick) return 5;
  if (id === B.oak_sapling) return 5;
  return 0;
}

// mining time for block with current held item, seconds; Infinity if unbreakable
function breakTime(blockId, heldId) {
  const b = Blocks[blockId];
  if (!b || b.hardness < 0) return Infinity;
  let t = b.hardness;
  const held = heldId >= 256 ? Items[heldId] : null;
  if (held && b.tool !== T_NONE && held.tool === b.tool) t /= held.speed;
  else if (held && held.tool === T_SWORD && b.flammable && b.rt === RT_LEAVES) t /= 3;
  // penalty when the required tool is missing (won't drop either)
  if (b.needsTool && (!held || held.tool !== b.tool || held.tier < b.needsTool)) t *= 3.3;
  return Math.max(0.05, t);
}
function willDrop(blockId, heldId) {
  const b = Blocks[blockId];
  if (!b.needsTool) return true;
  const held = heldId >= 256 ? Items[heldId] : null;
  return !!(held && held.tool === b.tool && held.tier >= b.needsTool);
}
function blockDrops(blockId, heldId) {
  const b = Blocks[blockId];
  if (!willDrop(blockId, heldId)) return null;
  if (b.drops === null || b.drops === undefined) return [blockId, 1];
  if (typeof b.drops === 'function') {
    const d = b.drops();
    return d ? [nameToId(d[0]), d[1]] : null;
  }
  return [nameToId(b.drops[0]), b.drops[1]];
}
