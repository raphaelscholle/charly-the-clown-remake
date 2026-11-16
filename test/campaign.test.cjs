const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../dist/level-data.js');
require('../dist/engine.js');
require('../dist/terrain.js');

const { Game, stage, STEP } = Charly;
const ids = [...Array.from({ length: 25 }, (_, i) => i + 1), 70, 98, 99];

function advance(game, seconds, action = () => {}) {
  for (let frame = 0; frame < Math.ceil(seconds / STEP) && !game.finished; frame++) {
    action();
    game.step(STEP);
  }
}

function position(game, x, y) {
  game.player = { ...game.createPlayer({ x, y }), grounded: true, invulnerable: 0 };
  game.release();
}

function tapJump(game) {
  game.input('jump', true);
  advance(game, .041);
  game.input('jump', false);
  advance(game, 1.22);
}

test('loads every map with its authored exit and starts without losing a life', () => {
  for (const number of ids) {
    const game = new Game();
    game.reset(number);
    assert.equal(game.level.art.length, 100);
    assert.equal(game.level.collision.length, 100);
    assert.ok(game.level.art.every(row => row.length === game.level.columns));
    assert.ok(game.level.collision.every(row => row.length === game.level.columns));
    const exits = game.level.gates.filter(gate => !gate.entry);
    const next = number < 25 ? number + 1 : { 25: 70, 70: 1, 98: 24, 99: 4 }[number];
    assert.ok(exits.some(gate => gate.value === next), 'exit for ' + number);
    advance(game, 1.25);
    assert.equal(game.lives, 5, 'spawn on ' + number);
  }
});

test('a two-coin question box only awards coins on underside impacts', () => {
  const game = new Game();
  const box = game.blocks.find(item => item.x === 548);
  assert.equal(box.remaining, 2);
  position(game, 555, 1312);
  advance(game, .2);
  assert.equal(box.remaining, 2);
  tapJump(game);
  assert.equal(box.remaining, 1);
  assert.equal(game.coins, 1);
  tapJump(game);
  assert.equal(box.remaining, 0);
  tapJump(game);
  assert.equal(game.coins, 2);
});

test('the three high platforms on level one support successive jumps', () => {
  const game = new Game();
  position(game, 1556, 1312);
  for (const y of [1272, 1211, 1150]) {
    tapJump(game);
    assert.equal(game.player.y, y);
    assert.equal(game.player.grounded, true);
  }
});

test('every hidden door matches its original bonus spawn and its return exit', () => {
  const routes = [[4, 99, 9901, 114], [4, 99, 9902, 124], [24, 98, 9801, 224]];
  for (const [source, bonus, outgoing, returning] of routes) {
    const game = new Game();
    game.reset(source);
    const box = game.blocks[0];
    box.remaining = 0;
    const door = game.level.gates.find(gate => !gate.entry && gate.tag === outgoing);
    position(game, door.x + door.w / 2, door.y + door.h);
    game.gateWait = 0;
    game.checkGate();
    assert.equal(game.level.number, source);
    game.input('duck', true);
    game.checkGate();
    assert.equal(game.level.number, bonus);
    const arrival = stage(bonus).gates.find(gate => gate.entry && gate.tag === outgoing);
    assert.equal(game.player.x, arrival.x + arrival.w / 2);
    const exit = game.level.gates.find(gate => !gate.entry && gate.tag === returning);
    position(game, exit.x + exit.w / 2, exit.y + exit.h);
    game.gateWait = 0;
    game.checkGate();
    assert.equal(game.level.number, source);
    const back = stage(source).gates.find(gate => gate.entry && gate.tag === returning);
    assert.equal(game.player.x, back.x + back.w / 2);
    assert.equal(game.blocks[0], box);
    assert.equal(game.blocks[0].remaining, 0);
  }
});

test('a full run through the first level reaches the original circus exit', () => {
  const game = new Game();
  let jumpAt = -Infinity;
  let previousX = 0;
  advance(game, 70, () => {
    const p = game.player;
    game.input('right', true);
    const stalled = Math.abs(p.x - previousX) < .1 && p.x > 150;
    if (p.grounded && game.time - jumpAt > .55 &&
        (stalled || (p.x > 2535 && p.x < 2636) || (p.x > 1180 && p.x < 1370))) {
      game.input('jump', false);
      game.input('jump', true);
      jumpAt = game.time;
    }
    if (game.time - jumpAt > .43) game.input('jump', false);
    previousX = p.x;
  });
  assert.equal(game.finishedTarget, 2);
});

test('wood disappears with its collision and returns after a life is lost', () => {
  const game = new Game();
  position(game, 1548, 1269);
  const plank = game.props.find(prop => prop.type === 4 && prop.x === 1540 && prop.y === 1272);
  const neighbor = game.props.find(prop => prop.type === 4 && prop.x === 1556 && prop.y === 1272);
  advance(game, .2);
  assert.equal(game.player.riding, plank);
  assert.equal(game.woodFrame(plank), 0);
  advance(game, 1.2);
  assert.equal(game.woodFrame(plank), 7);
  assert.equal(game.supports(plank), false);
  assert.equal(game.supports(neighbor), true);
  assert.ok(game.player.y > plank.y);
  game.loseLife();
  assert.equal(game.supports(plank), true);
});

test('cannons keep their authored direction and survive marble hits', () => {
  const game = new Game();
  game.reset(2);
  const [right, left] = game.monsters.filter(mob => mob.kind === 'cannon');
  assert.equal(right.face, 1);
  assert.equal(left.face, -1);
  for (const cannon of [right, left]) {
    position(game, cannon.x - 60, cannon.y + 40);
    game.time = cannon.fireAt;
    game.fireCannon(cannon, game.player);
    const ball = game.enemyShots.at(-1);
    assert.equal(Math.sign(ball.vx), cannon.face);
    assert.ok(ball.vy < 0);
    assert.ok(cannon.recoilUntil > game.time);
    game.shots = [{ x: cannon.x + 16, y: cannon.y + 16, vx: 0, vy: 0, life: 1 }];
    game.updateShots(STEP);
    assert.equal(game.shots.length, 0);
    assert.equal(cannon.defeated, false);
  }
});

test('LOLLY is playable from spawn across the wooden bridge to the level 4 exit', () => {
  const game = new Game();
  game.reset(3);
  while (!game.player.grounded && game.time < 2) game.step(STEP);
  // Direction, action, release frame, short-jump release frame, and total frames.
  const route = [
    [1, "jump", 120, 0, 121],
    [1, "jump", 80, 0, 191],
    [1, "jump", 102, 19, 128],
    [1, "jump", 120, 0, 167],
    [1, "jump", 120, 0, 180],
    [1, "jump", 80, 0, 180],
    [1, "jump", 102, 3, 175],
    [1, "jump", 102, 10, 122],
    [1, "duck", 138, 0, 176],
    [1, "jump", 120, 0, 210],
    [1, "jump", 120, 0, 201],
    [1, "jump", 120, 0, 191],
    [1, "jump", 120, 0, 210],
    [1, "jump", 120, 0, 151],
    [1, "jump", 80, 0, 201],
    [1, "duck", 138, 0, 174],
    [1, "jump", 120, 0, 201],
    [1, "jump", 120, 0, 201],
    [1, "jump", 120, 0, 121],
    [1, "jump", 120, 0, 180],
    [1, "jump", 120, 0, 193],
    [1, "jump", 120, 0, 201],
    [1, "jump", 120, 0, 222],
    [1, "jump", 120, 0, 205],
    [1, "jump", 120, 0, 201],
    [1, "jump", 102, 19, 128],
    [1, "jump", 120, 0, 121],
    [1, "jump", 102, 19, 124],
    [0, "jump", 59, 0, 145],
    [1, "jump", 102, 3, 103],
    [-1, "duck", 42, 0, 43],
    [-1, "jump", 102, 10, 130],
    [-1, "", 17, 0, 18],
    [-1, "jump", 102, 10, 103],
    [1, "jump", 50, 0, 140],
    [1, "jump", 80, 0, 174],
    [1, "jump", 102, 19, 208],
    [1, "jump", 102, 3, 89],
  ];
  let crossedBridge = false;
  for (const [direction, action, releaseAt, jumpHold, frames] of route) {
    game.release();
    if (direction) game.input(direction > 0 ? 'right' : 'left', true);
    if (action) game.input(action, true);
    for (let frame = 0; frame < frames && !game.finished; frame++) {
      if (jumpHold && frame === jumpHold) game.input('jump', false);
      if (frame === releaseAt) game.release();
      game.step(STEP);
      crossedBridge ||= game.player.riding?.type === 4 && game.player.x > 3000;
    }
  }
  assert.ok(crossedBridge);
  assert.equal(game.finishedTarget, 4);
  assert.equal(game.lives, 5);
});

test('run animation advances with grounded travel and stops during airtime', () => {
  const game = new Game();
  position(game, 158, 1312);
  advance(game, .12);
  assert.equal(game.player.travel, 0);
  assert.equal(game.player.walking, false);
  game.input('right', true);
  advance(game, .18);
  assert.ok(game.player.travel > 12);
  assert.equal(game.player.walking, true);
  game.input('jump', true);
  const beforeJump = game.player.travel;
  advance(game, .12);
  assert.equal(game.player.walking, false);
  assert.equal(game.player.travel, beforeJump);
});

test('spring animation is triggered by the same launch as the jump', () => {
  const game = new Game();
  const spring = game.props.find(prop => prop.type === 7);
  position(game, spring.x + spring.w / 2, spring.y);
  assert.equal(spring.sprungAt, -Infinity);
  game.launch(game.player, spring);
  assert.equal(game.player.spring, true);
  assert.equal(spring.sprungAt, game.time);
});

test('the LOLLY bridge ramp supports continuous walking in both directions', () => {
  const game = new Game();
  game.reset(3);
  const ramp = game.level.ramps.find(surface => surface.x === 2816);
  for (const [start, finish, y, action] of [[2790, 2951, 1264, 'right'], [2964, 2790, 1200, 'left']]) {
    position(game, start, y);
    game.player.invulnerable = 5;
    game.input(action, true);
    let samples = 0;
    for (let frame = 0; frame < 160; frame++) {
      game.step(STEP);
      const { x, y, grounded } = game.player;
      if (x > ramp.x + 5 && x < ramp.x + ramp.w - 5) {
        assert.equal(grounded, true);
        assert.equal(y, Charly.rampHeight(ramp, x));
        samples++;
      }
      if (action === 'left' ? x <= finish : x >= finish) break;
    }
    assert.ok(samples > 80);
    assert.equal(game.player.grounded, true);
    assert.ok(action === 'left' ? game.player.x <= finish : game.player.x >= finish);
  }
});

test('Down drops through the joined cables in POING and reaches the lower landing', () => {
  const game = new Game();
  game.reset(4);
  position(game, 3525, 409);
  advance(game, .14);
  assert.equal(game.player.riding?.type, 12);
  assert.equal(game.player.y, 411);
  game.input('duck', true);
  advance(game, 1.08);
  assert.equal(game.player.y, 688);
  assert.equal(game.player.grounded, true);
  assert.equal(game.lives, 5);
});

test('POING is playable from spawn through the shaft to the PARROT exit', () => {
  const game = new Game();
  game.reset(4);
  while (!game.player.grounded && game.time < 2) game.step(STEP);
  // Direction, input release, jump release, duck, throw, and total frames.
  const route = [
    [1, 200, 90, false, false, 241],
    [1, 160, 160, false, false, 215],
    [1, 120, 0, false, false, 121],
    [-1, 18, 0, false, false, 19],
    [1, 200, 90, false, false, 201],
    [1, 190, 18, false, false, 191],
    [1, 200, 90, false, false, 224],
    [1, 18, 0, false, false, 10],
    [1, 162, 0, false, false, 163],
    [1, 200, 90, false, false, 191],
    [1, 200, 90, false, false, 201],
    [1, 200, 90, false, false, 201],
    [1, 73, 0, false, false, 45],
    [1, 200, 90, false, false, 219],
    [1, 18, 0, false, false, 19],
    [1, 38, 0, true, false, 47],
    [1, 162, 0, false, false, 202],
    [-1, 162, 0, false, false, 210],
    [1, 73, 0, false, false, 75],
    [-1, 118, 120, false, false, 123],
    [1, 38, 0, true, false, 39],
    [1, 138, 0, true, true, 139],
    [1, 80, 18, false, false, 84],
    [1, 28, 5, false, false, 29],
    [-1, 40, 0, false, false, 228],
    [1, 40, 0, false, false, 29],
    [1, 200, 90, false, false, 201],
    [1, 120, 0, false, false, 146],
    [1, 80, 18, false, false, 81],
    [1, 200, 90, false, false, 201],
    [1, 80, 18, false, false, 125],
    [1, 200, 90, false, false, 201],
    [1, 162, 0, false, false, 163],
    [1, 200, 90, false, false, 171],
  ];
  for (const [direction, releaseAt, hop, duck, fire, frames] of route) {
    game.release();
    if (direction) game.input(direction > 0 ? 'right' : 'left', true);
    if (hop) game.input('jump', true);
    if (duck) game.input('duck', true);
    if (fire) game.input('throw', true);
    for (let frame = 0; frame < frames; frame++) {
      if (frame === hop) game.input('jump', false);
      if (frame === releaseAt) game.release();
      game.step(STEP);
    }
  }
  assert.ok(Math.abs(game.player.x - 4395) < 12);
  assert.equal(game.player.y, 1360);
  game.release();

  const lift = game.props.find(prop => prop.type === 16);
  let boarded = false;
  let jumping = false;
  let leaving = false;
  for (let frame = 0; frame < 5000 && !game.finished; frame++) {
    const p = game.player;
    if (!jumping && lift.currentY > 1285 && lift.shiftY > 0) {
      game.input('right', true);
      game.input('jump', true);
      jumping = true;
    }
    if (jumping && !leaving && p.x >= 4438) game.release();
    boarded ||= p.riding === lift;
    if (boarded && !leaving && p.y < 251 && lift.shiftY < 0) {
      game.input('left', true);
      leaving = true;
    }
    game.step(STEP);
  }
  assert.ok(boarded);
  assert.equal(game.finishedTarget, 5);
  assert.equal(game.lives, 5);
});

test('the canopy and root tiles at the first spring become two grounded trees', () => {
  const terrain = sceneryTerrain(1);
  const trees = terrain.objects.filter(({ art, x }) => art === 'redrawn-jungle-tree' && x >= 820 && x <= 1040);
  assert.deepEqual(trees.map(({ x, y, h }) => [x, y, h]), [[848, 1312, 112], [1008, 1312, 112]]);
});

test('the level one exit uses a boulder pile and retains the original floor', () => {
  const terrain = sceneryTerrain(1);
  assert.ok(terrain.objects.some(o => o.art === 'redrawn-scree' && o.x === 2768 && o.y === 1184));
  for (const [x, y] of [[2720, 1120], [2704, 1136], [2816, 1152]]) {
    assert.ok(terrain.coveredTiles.has(sceneryCell(terrain.level, x, y)));
  }
  assert.ok(!terrain.coveredTiles.has(sceneryCell(terrain.level, 2752, 1184)));
  assert.equal(Charly.at(terrain.level, 2752 / 16, 1184 / 16 + 2) & 127, 1);
});

test('the More Easy stump has its visible crown at the collision height', () => {
  const terrain = sceneryTerrain(2);
  const stump = terrain.objects.find(o => o.art === 'redrawn-stump' && o.x === 4056);
  assert.ok(stump);
  assert.equal(stump.y, 1376);
  assert.equal(stump.y - stump.h, 1360);
  assert.equal(Charly.at(terrain.level, 4056 / 16 | 0, 1360 / 16 + 2) & 127, 5);
});

test('detached slope fragments are omitted and the nearby floor remains visible', () => {
  for (const [id, x, y] of [[3, 3456, 1216], [12, 192, 1152]]) {
    const terrain = sceneryTerrain(id);
    assert.ok(terrain.coveredTiles.has(sceneryCell(terrain.level, x, y)));
    assert.ok(terrain.coveredTiles.has(sceneryCell(terrain.level, x, y + 16)));
    assert.ok(!terrain.coveredTiles.has(sceneryCell(terrain.level, x, y + 48)));
  }
});

function sceneryTerrain(number) {
  const dimensions = new Proxy({}, { get: () => ({ width: 500, height: 470 }) });
  const terrain = new Charly.Terrain(dimensions);
  terrain.prepare(stage(number));
  return terrain;
}

function sceneryCell(level, x, y) {
  return (y / 16 + 3) * level.columns + x / 16;
}
