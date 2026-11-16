(() => {
  'use strict';

  const SIZE = 16;
  const MAP_HEIGHT = 1552;
  const STEP = 1 / 120;
  const GRAVITY = 490;
  const JUMP_SPEED = 411;
  const RADIUS = 9;
  const CRUMBLE_FRAME = .042;
  const CRUMBLE_ANIMATION = 6 * CRUMBLE_FRAME;
  const BALL_RADIUS = 4;
  const GRIP_HEIGHT = 38;
  const FOOT_REACH = RADIUS - 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const near = (a, b, tolerance) => Math.abs(a - b) < tolerance;
  const range = (a, b) => [Math.floor(a), Math.floor(b)];

  function ballSurface(ball, x, left, topY) {
    const radius = ball.w / 2;
    const distance = Math.max(0, Math.abs(x - (left + radius)) - FOOT_REACH);
    if (distance > radius) return Infinity;
    return topY + ball.h / 2 * (1 - Math.sqrt(1 - (distance / radius) ** 2));
  }
  const decodeRows = (rows, columns, ArrayType) => rows.map(runs => {
    const row = new ArrayType(columns);
    let column = 0;
    for (const [count, id] of runs) {
      row.fill(id, column, column + count);
      column += count;
    }
    return row;
  });
  const creatureNames = ['bomb', 'cactus', 'bomb', 'ghost', 'cannon', 'bee', 'bat', 'crawler', 'crawler', 'rock', 'crawler', 'crawler', 'beam', 'beam', 'rock', 'beam'];
  const pickupNames = ['coin', 'ammo', 'bottle', 'box', 'health', 'bonus', 'coin', 'bonus', 'ruby', 'star'];

  function object(raw) {
    const [id, x, y, w, h, type, value, entry, variant, hidden, tag, speed, a, b, c, d, pathX, pathY, dx, dy] = raw;
    return { id, x, y, w, h, type, value, entry, variant, hidden, tag, speed, a, b, c, d, pathX, pathY, dx, dy };
  }

  const stages = new Map();
  function stage(number) {
    if (stages.has(number)) return stages.get(number);
    const source = CharlyStages[number];
    if (!source) throw new Error('Unknown level ' + number);
    const events = source.objects.map(object);
    const value = {
      number,
      name: source.name,
      width: source.columns * SIZE,
      columns: source.columns,
      spawn: { x: source.start[0] + 13, y: clamp(source.start[1] - 40, 24, MAP_HEIGHT - 16) },
      snow: number === 9 || number === 10,
      vista: number === 9 || number === 10 ? 7 : number === 5 || number === 14 ? 5 : number === 17 || number === 18 ? 4 : number === 24 || number === 70 ? 6 : 0,
      flight: number === 5,
      art: decodeRows(source.art, source.columns, Uint16Array),
      collision: decodeRows(source.collision, source.columns, Uint8Array),
      pickups: source.items.map(object).filter(item => item.x > 0 || item.type !== 0),
      enemies: source.enemies.map(object).filter(enemy => enemy.x > 0 || enemy.type !== 0),
      gates: events.filter(item => item.type === 2 && CharlyStages[item.value]),
      props: events.filter(item => item.type >= 4),
      ramps: events.filter(item => item.type === 1 && item.w > 4),
      checkpoints: events.filter(item => item.type === 3),
    };
    if (number === 4) {
      const chain = value.props.find(prop => prop.type === 12 && prop.x === 3316 && prop.y === 411);
      if (chain) {
        // Extend the grip to the ball side of the shaft wall.
        value.props.push({ ...chain, id: -1, x: 3275, w: chain.x - 3275 });
      }
    }
    stages.set(number, value);
    return value;
  }

  function rampHeight(ramp, x) {
    const part = clamp((x - ramp.x) / ramp.w, 0, 1);
    return ramp.y + ramp.h * (ramp.hidden ? part : 1 - part);
  }

  function at(level, column, row) {
    return level.collision[row]?.[column] ?? 0;
  }

  function mask(level, column, row) {
    return at(level, column, row) & 127;
  }

  const top = flag => flag === 1 || flag === 4 || flag === 5 || flag === 9 || flag === 10;
  const sides = flag => flag === 2 || flag === 4 || flag === 5 || flag === 6 || flag === 10;
  const ceiling = flag => flag === 3 || flag === 4 || flag === 6;
  const dangerous = flag => flag === 7;
  const inside = (p, item, extra = 0) => p.x + RADIUS > item.x - extra && p.x - RADIUS < item.x + item.w + extra &&
    p.y > item.y - extra && p.y - p.height < item.y + item.h + extra;
  const position = item => ({ x: item.x + item.w / 2, y: item.y + item.h / 2 });

  function fromGate(level, gate) {
    if (!gate) {
      const { x, y } = level.spawn;
      const support = level.flight ? null : localFloor(level, x, y - 24, 24);
      return { x, y: support ?? y };
    }
    const x = clamp(gate.x + gate.w / 2, RADIUS, level.width - RADIUS);
    const underneath = localFloor(level, x, gate.y + 3, 72);
    return { x, y: underneath ?? gate.y + gate.h };
  }

  function localFloor(level, x, y, maxDistance) {
    const col = Math.floor(x / SIZE);
    const [first, last] = range(y / SIZE + 2, (y + maxDistance) / SIZE + 2);
    for (let row = first; row <= last; row++) {
      const floor = (row - 2) * SIZE;
      if (floor >= y - 2 && top(mask(level, col, row))) return floor;
    }
    return null;
  }

  function elevatorRise(level, item) {
    const col = Math.floor((item.x + item.w / 2) / SIZE);
    const start = Math.floor(item.y / SIZE) + 1;
    // POING's only lift serves the entire exit shaft, from the spikes to the upper landing.
    const fullShaft = level.number === 4;
    const limit = fullShaft ? 3 : Math.max(3, start - 27);
    for (let row = start; row >= limit; row--) {
      if (ceiling(mask(level, col, row))) {
        const rise = item.y - (row - 1) * SIZE - 39;
        return clamp(rise, 80, fullShaft ? item.y - 45 : 420);
      }
    }
    return Math.min(item.y - 45, 345);
  }

  class Game {
    constructor(onEvent = () => {}) {
      this.event = onEvent;
      this.keys = new Set();
      this.reset(1);
    }

    reset(number = this.level?.number ?? 1, continueRun = false) {
      if (!continueRun) {
        this.score = 0;
        this.coins = 0;
        this.ammo = 0;
        this.lives = 5;
        this.health = 5;
        this.secrets = new Set();
      }
      this.branch = null;
      this.load(number);
    }

    load(number, entry) {
      this.level = stage(number);
      this.pickups = this.level.pickups.filter(item => item.type !== 3).map(item => ({
        ...item, kind: pickupNames[item.type] || 'bonus', collected: false,
      }));
      this.blocks = this.level.pickups.filter(item => item.type === 3).map(item => ({
        ...item, remaining: Math.max(1, item.value), bump: 0,
      }));
      this.monsters = this.level.enemies.map(item => ({
        ...item, kind: creatureNames[item.type] || 'crawler', currentX: item.x, currentY: item.y,
        hp: item.type === 4 ? Infinity : item.type === 1 ? Math.max(1, item.value) : item.type === 9 ? 2 : 1,
        defeated: false, face: item.hidden === 2 ? 1 : -1, travel: 0,
        fireAt: .15 + item.tag / 24, recoilUntil: 0, phased: item.type === 3,
      }));
      this.props = this.level.props.map(item => ({
        ...item, currentX: item.x, currentY: item.y, shiftX: 0, shiftY: 0, seen: false, crumbleAt: Infinity, sprungAt: -Infinity,
        rise: item.type === 16 ? elevatorRise(this.level, item) : 0,
      }));
      this.particles = [];
      this.outcomes = [];
      this.shots = [];
      this.enemyShots = [];
      this.time = 0;
      this.finished = false;
      this.finishedTarget = null;
      this.gateWait = .7;
      this.throwWait = 0;
      this.toggle = new Set();
      this.checkpoint = fromGate(this.level, entry);
      this.checkpointAt = this.checkpoint.x;
      this.player = this.createPlayer(this.checkpoint);
      this.release();
    }

    createPlayer(where) {
      return {
        ...where, vx: 0, vy: 0, height: this.level.flight ? 25 : 32, face: 1,
        grounded: false, riding: null, invulnerable: .6, coyote: 0, duck: false, spring: false, travel: 0, walking: false,
      };
    }

    input(action, pressed) {
      if (pressed && !this.keys.has(action)) {
        if (action === 'jump') this.jumpBuffer = .14;
        if (action === 'duck' && (this.player.hanging || this.player.riding?.type === 12)) this.dropFromCable();
        if (action === 'throw') this.throwMarble();
      }
      if (pressed) this.keys.add(action);
      else this.keys.delete(action);
    }

    dropFromCable() {
      const p = this.player;
      p.dropCableY = (p.hanging ?? p.riding).currentY;
      p.hanging = null;
      p.riding = null;
      p.grounded = false;
      p.coyote = 0;
      p.vy = 60;
      this.jumpBuffer = 0;
    }

    release() {
      this.keys.clear();
      this.jumpBuffer = 0;
    }

    step(dt) {
      if (this.finished) return;
      this.time += dt;
      this.throwWait = Math.max(0, this.throwWait - dt);
      this.gateWait = Math.max(0, this.gateWait - dt);
      for (const box of this.blocks) box.bump = Math.max(0, box.bump - dt);

      this.moveProps();
      if (this.level.flight) this.movePlane(dt);
      else this.movePlayer(dt);
      if (this.finished) return;
      this.collect();
      this.updateMonsters(dt);
      this.updateShots(dt);
      this.updateParticles(dt);
      this.checkGate();
      this.recordCheckpoint();
    }

    moveProps() {
      for (const prop of this.props) {
        const previousX = prop.currentX;
        const previousY = prop.currentY;
        if (prop.type === 15) {
          const phase = (this.time + prop.variant * .38 + prop.speed / 1000) % 2.85;
          prop.active = phase > 1.32;
          prop.warning = phase > 1.12 && !prop.active;
        } else if (prop.type === 16) {
          const period = Math.max(2.8, prop.rise / (this.level.number === 4 ? 92 : 50));
          const phase = (this.time + prop.id * .19) / period * Math.PI;
          prop.currentY = prop.y - prop.rise * (.5 - Math.cos(phase) * .5);
        } else if (prop.type === 8) {
          const endpoint = prop.pathX > 0 && Math.abs(prop.pathX - prop.x) < 185 ? prop.pathX : prop.x + 32;
          const phase = this.time * 1.45 + prop.tag * Math.PI / 180;
          prop.currentX = prop.x + (endpoint - prop.x) * (.5 - Math.cos(phase) * .5);
          prop.currentY = prop.y + Math.sin(phase) * 8;
        } else if (prop.type === 13 && prop.w < 80) {
          prop.currentY = prop.y + Math.sin(this.time * .92 + prop.id) * 22;
        }
        prop.shiftX = prop.currentX - previousX;
        prop.shiftY = prop.currentY - previousY;
      }
    }

    movePlane(dt) {
      const p = this.player;
      const horizontal = Number(this.keys.has('right')) - Number(this.keys.has('left'));
      const vertical = Number(this.keys.has('duck')) - Number(this.keys.has('jump'));
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.vx += clamp(horizontal * 161 - p.vx, -550 * dt, 550 * dt);
      p.vy += clamp(vertical * 134 - p.vy, -550 * dt, 550 * dt);
      if (horizontal) p.face = horizontal;
      const x = clamp(p.x + p.vx * dt, RADIUS, this.level.width - RADIUS);
      const y = clamp(p.y + p.vy * dt, p.height + 4, MAP_HEIGHT - 3);
      const flag = mask(this.level, Math.floor(x / SIZE), Math.floor((y - p.height / 2) / SIZE) + 2);
      if (flag && flag <= 10) {
        this.takeHit(x - (horizontal || 1) * -10);
        p.vx *= -.18;
        p.vy *= -.18;
      } else {
        p.x = x;
        p.y = y;
      }
      if (this.keys.has('throw')) this.throwMarble();
    }

    holdCable(player, direction, dt) {
      const cable = player.hanging;
      const x = player.x + direction * 88 * dt;
      const next = this.props.find(prop => prop.type === 12 && prop.currentY === cable.currentY &&
        x >= prop.currentX - 2 && x <= prop.currentX + prop.w + 2);
      if (!next) {
        this.dropFromCable();
        return false;
      }
      player.hanging = next;
      player.y = next.currentY + GRIP_HEIGHT;
      player.vy = 0;
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      this.moveAcross(player, x);
      if (direction) player.face = direction;
      return true;
    }

    movePlayer(dt) {
      const p = this.player;
      const direction = Number(this.keys.has('right')) - Number(this.keys.has('left'));
      if (p.hanging) {
        if (this.jumpBuffer > 0) {
          p.dropCableY = p.hanging.currentY;
          p.hanging = null;
          p.vy = -JUMP_SPEED;
          this.jumpBuffer = 0;
          this.event('jump');
        } else if (this.holdCable(p, direction, dt)) {
          this.checkHazard();
          return;
        }
      }
      if (p.riding) {
        if (this.supports(p.riding)) {
          p.x += p.riding.shiftX;
          p.y += p.riding.shiftY;
        } else {
          p.riding = null;
          p.grounded = false;
        }
      }
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      p.duck = p.grounded && this.keys.has('duck');
      p.height = p.duck ? 16 : 32;
      p.coyote = p.grounded ? .095 : Math.max(0, p.coyote - dt);
      if (this.jumpBuffer > 0 && p.coyote > 0 && !p.duck) {
        p.vy = -JUMP_SPEED;
        p.grounded = false;
        p.riding = null;
        p.coyote = 0;
        this.jumpBuffer = 0;
        this.event('jump');
      }
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      if (direction) p.face = direction;
      const speed = (p.duck ? 53 : 154) * direction;
      p.vx += clamp(speed - p.vx, -1260 * dt, 1260 * dt);
      if (p.vy < -229 && !p.spring && !this.keys.has('jump')) p.vy = -229;
      p.vy = clamp(p.vy + GRAVITY * dt, -605, 420);
      const previousX = p.x;
      this.moveAcross(p, p.x + p.vx * dt);
      this.moveVertical(p, p.y + p.vy * dt, previousX);
      const distance = Math.abs(p.x - previousX);
      p.walking = p.grounded && distance > dt * 13;
      if (p.grounded) {
        p.travel += distance;
        const spring = this.props.find(prop => prop.type === 7 && p.x > prop.currentX + 2 &&
          p.x < prop.currentX + prop.w - 2 && p.y >= prop.currentY - .5 && p.y <= prop.currentY + 18);
        if (spring) this.launch(p, spring);
      }
      if (p.y > MAP_HEIGHT + 48) this.loseLife();
      else this.checkHazard();
    }

    moveAcross(p, next) {
      const old = p.x;
      const direction = Math.sign(next - old);
      if (!direction) return;
      const edge = next + direction * RADIUS;
      const [first, last] = range((p.y - p.height + 4) / SIZE + 2, (p.y - 5) / SIZE + 2);
      const col = Math.floor((edge - (direction < 0 ? .01 : 0)) / SIZE);
      const stop = direction > 0 ? col * SIZE - RADIUS : (col + 1) * SIZE + RADIUS;
      for (let row = first; row <= last; row++) {
        const flag = mask(this.level, col, row);
        if (!sides(flag)) continue;
        if (direction > 0 && old <= stop + .5 && next > stop) next = stop;
        else if (direction < 0 && old >= stop - .5 && next < stop) next = stop;
      }
      p.x = clamp(next, RADIUS, this.level.width - RADIUS);
      if (p.x !== next || near(p.x, old, .04)) p.vx *= .4;
    }

    moveVertical(p, nextY, previousX = p.x) {
      const before = p.y;
      if (p.dropCableY !== undefined && (before > p.dropCableY + GRIP_HEIGHT + 6 || before < p.dropCableY - 2)) p.dropCableY = undefined;
      const reach = p.vy >= 0 ? nextY : nextY - p.height;
      const origin = p.vy >= 0 ? before : before - p.height;
      const rising = p.vy < 0;
      const wasGrounded = p.grounded;
      const previousRide = p.riding;
      const [firstColumn, lastColumn] = range((p.x - FOOT_REACH) / SIZE, (p.x + FOOT_REACH) / SIZE);
      const [firstRow, lastRow] = range(Math.min(origin, reach) / SIZE + 1, Math.max(origin, reach) / SIZE + 3);
      p.riding = null;
      p.grounded = false;
      if (rising) {
        if (this.keys.has('jump') && !this.keys.has('duck')) {
          const cable = this.props.find(prop => prop.type === 12 && prop.currentY !== p.dropCableY &&
            before >= prop.currentY + GRIP_HEIGHT && nextY <= prop.currentY + GRIP_HEIGHT &&
            p.x >= prop.currentX - 3 && p.x <= prop.currentX + prop.w + 3);
          if (cable) {
            const gripY = cable.currentY + GRIP_HEIGHT;
            const col = Math.floor(p.x / SIZE);
            const flag = mask(this.level, col, Math.floor((gripY - p.height) / SIZE) + 2);
            if (flag === 0 || flag > 10) {
              p.hanging = cable;
              p.y = gripY;
              p.vy = 0;
              p.coyote = 0;
              this.jumpBuffer = 0;
              return;
            }
          }
        }
        let roof = -Infinity;
        for (let row = firstRow; row <= lastRow; row++) {
          const bottom = (row - 1) * SIZE;
          if (bottom > origin + .3 || reach > bottom) continue;
          for (let col = firstColumn; col <= lastColumn; col++) {
            if (ceiling(mask(this.level, col, row))) roof = Math.max(roof, bottom);
          }
        }
        for (const box of this.blocks) {
          if (!box.remaining) continue;
          const bottom = box.y + box.h;
          if (p.x + RADIUS > box.x && p.x - RADIUS < box.x + box.w && origin >= bottom - .6 && reach <= bottom && bottom >= roof) {
            this.hitBox(box);
            p.y = bottom + p.height;
            p.vy = Math.max(0, p.vy);
            p.spring = false;
            return;
          }
        }
        if (Number.isFinite(roof)) {
          p.vy = 0;
          p.spring = false;
          nextY = roof + p.height;
        }
      } else {
        let landing = Infinity;
        for (let row = firstRow; row <= lastRow; row++) {
          const floor = (row - 2) * SIZE;
          if (floor < origin - .6 || floor > reach) continue;
          for (let col = firstColumn; col <= lastColumn; col++) {
            if (top(mask(this.level, col, row))) landing = Math.min(landing, floor);
          }
        }
        for (const ramp of this.level.ramps) {
          if (p.x < ramp.x - 1 || p.x > ramp.x + ramp.w + 1) continue;
          const y = rampHeight(ramp, p.x);
          const tolerance = wasGrounded ? 3.2 : .7;
          if (y >= origin - tolerance && y <= reach + tolerance) landing = Math.min(landing, y);
        }
        for (const prop of this.props) {
          if (!this.supports(prop) || (prop.type === 12 && prop.currentY === p.dropCableY)) continue;
          const x = prop.currentX;
          let y = prop.currentY;
          const inset = prop.type === 7 ? 4 : 0;
          if (p.x + FOOT_REACH < x + inset || p.x - FOOT_REACH > x + prop.w - inset) continue;
          if (prop.type === 8) {
            y = ballSurface(prop, p.x, x, y);
            const previousTop = prop.currentY - prop.shiftY;
            const previousSurface = ballSurface(prop, previousX, x - prop.shiftX, previousTop);
            // Compare feet against the moving upper surface on both sides of the step.
            // A rider follows the curve until their feet leave the ball's width.
            const entryHeight = Math.min(previousSurface, previousTop + prop.h / 2);
            if (previousRide !== prop && (origin > entryHeight + .5 || reach < y)) continue;
          } else if (origin > y + Math.abs(prop.shiftY) + .8 || reach < y - .5) {
            continue;
          }
          if (y < landing) {
            landing = y;
            p.riding = prop;
          }
        }
        if (Number.isFinite(landing)) {
          p.grounded = true;
          nextY = landing;
          p.vy = 0;
          p.spring = false;
          if (p.riding) {
            p.riding.seen = true;
            if (p.riding.type === 4 && !Number.isFinite(p.riding.crumbleAt)) {
              p.riding.crumbleAt = this.time + Math.max(1, p.riding.value) / 24;
            }
            if (p.riding.type === 7) {
              this.launch(p, p.riding);
            }
          }
        }
      }
      p.y = nextY;
    }

    woodFrame(prop) {
      return Math.min(7, Math.max(0, 1 + Math.floor((this.time - prop.crumbleAt) / CRUMBLE_FRAME)));
    }

    supports(prop) {
      if (prop.type === 4) return this.time < prop.crumbleAt + CRUMBLE_ANIMATION;
      if (prop.type === 17) return !this.toggle.has(prop.tag);
      return [5, 7, 8, 12, 13, 16].includes(prop.type);
    }

    launch(player, prop) {
      prop.sprungAt = this.time;
      player.y = prop.currentY;
      player.vy = -498;
      player.spring = true;
      player.grounded = false;
      player.riding = null;
      player.coyote = 0;
      this.spark(player.x, player.y, '#ffd166', 9);
      this.event('spring');
    }

    checkHazard() {
      const p = this.player;
      const foot = p.y - 3;
      const head = p.y - p.height + 3;
      const col = Math.floor(p.x / SIZE);
      const tileDanger = y => {
        if (!dangerous(mask(this.level, col, Math.floor(y / SIZE) + 2))) return false;
        return !this.props.some(prop => prop.type === 15 && p.x >= prop.x - 3 &&
          p.x <= prop.x + prop.w + 3 && y >= prop.y - 4 && y <= prop.y + prop.h + 4);
      };
      if (tileDanger(foot) || tileDanger(head)) {
        this.takeHit(p.x - p.face, true);
        return;
      }
      for (const prop of this.props) {
        const wet = prop.type === 14 && p.y > prop.y + 12 && !this.level.flight;
        if (!(wet || (prop.type === 15 && prop.active)) || !inside(p, prop, -2)) continue;
        this.takeHit(p.x - p.face, true);
        break;
      }
    }

    hitBox(box) {
      if (box.remaining <= 0 || box.bump > 0) return;
      box.remaining--;
      box.bump = .18;
      const p = position(box);
      this.award('coin', 1);
      this.outcomes.push({ x: p.x, y: box.y - 3, vy: -129, time: .59 });
      this.spark(p.x, box.y - 5, '#ffe07b', box.remaining ? 6 : 15);
      this.event('box', box);
    }

    award(kind, amount) {
      if (kind === 'coin') {
        this.coins += amount;
        this.score += 10 * amount;
      } else if (kind === 'ammo') {
        this.ammo += 10;
        this.score += 5;
      } else if (kind === 'health' || kind === 'bottle') {
        this.health = Math.min(5, this.health + (kind === 'bottle' ? 1 : 2));
        this.score += 10;
      } else if (kind === 'star') {
        this.lives = Math.min(99, this.lives + 1);
        this.score += 100;
      } else this.score += kind === 'bonus' ? 500 : 250;
      this.event(kind);
    }

    collect() {
      for (const item of this.pickups) {
        if (item.collected || !inside(this.player, item)) continue;
        item.collected = true;
        this.award(item.kind, 1);
        const p = position(item);
        this.spark(p.x, p.y, item.kind === 'ammo' ? '#92caff' : '#ffe07b', 8);
      }
    }

    updateMonsters(dt) {
      const p = this.player;
      for (const mob of this.monsters) {
        if (mob.defeated || !near(p.x, mob.x, 580) || !near(p.y, mob.y, 300)) continue;
        if (mob.kind === 'cannon') {
          this.fireCannon(mob, p);
          continue;
        }
        const previousX = mob.currentX;
        if (mob.kind === 'cactus') this.walkCactus(mob, dt);
        if (mob.kind === 'ghost') {
          const phase = (this.time + mob.variant * .23) % 3.2;
          mob.phased = phase < .72 || phase > 2.85;
          mob.opacity = .18 + .82 * clamp(Math.min((phase - .35) / .37, (3.15 - phase) / .30), 0, 1);
          mob.currentX = mob.x + Math.sin(this.time * 1.8 + mob.variant) * 30;
          mob.currentY = mob.y + Math.sin(this.time * 2.4 + mob.variant) * 15;
          mob.face = p.x > mob.currentX ? 1 : -1;
          if (mob.phased) continue;
        }
        const flyer = mob.kind === 'bat' || mob.kind === 'bee';
        const stationary = mob.kind === 'cactus' || mob.kind === 'ghost' || mob.kind === 'beam';
        if (!stationary) {
          const turn = this.time * (flyer ? 1.8 : 1.35) + mob.id * .91;
          mob.currentX = mob.x + Math.sin(turn) * (flyer ? 27 : 20);
          mob.currentY = mob.y + (flyer ? Math.sin(turn * 1.6) * 9 : 0);
        }
        const traveled = mob.currentX - previousX;
        mob.travel += Math.abs(traveled);
        if (!stationary && traveled) mob.face = Math.sign(traveled);
        const target = { x: mob.currentX + 3, y: mob.currentY + 3, w: mob.w - 5, h: mob.h - 5 };
        if (inside(p, target)) {
          if (!this.level.flight && p.vy > 55 && p.y <= target.y + 8 && !stationary) {
            p.vy = -170;
            this.defeat(mob);
          } else this.takeHit(target.x + target.w / 2);
        }
      }
    }

    walkCactus(mob, dt) {
      const nextX = mob.currentX + mob.face * (29 + mob.variant * 4) * dt;
      const footY = mob.currentY + mob.h;
      const edge = nextX + mob.w / 2 + mob.face * (mob.w / 2 - 4);
      const floor = localFloor(this.level, edge, footY - 2, 9);
      const col = Math.floor(edge / SIZE);
      const blocked = sides(mask(this.level, col, Math.floor((footY - 9) / SIZE) + 2));
      if (floor === null || blocked) {
        mob.face *= -1;
        return;
      }
      mob.currentX = nextX;
    }

    fireCannon(mob, p) {
      if (this.time < mob.fireAt || !near(p.x, mob.x, 385)) return;
      const angle = (5 + mob.variant * 10) * Math.PI / 180;
      const speed = mob.speed || 176;
      const x = mob.x + mob.w / 2 + mob.face * 16;
      const y = mob.y + 14;
      mob.fireAt = this.time + 1.7;
      mob.recoilUntil = this.time + .18;
      mob.flash = { x, y };
      this.enemyShots.push({ x, y, vx: Math.cos(angle) * speed * mob.face,
        vy: -Math.sin(angle) * speed, life: 3.8, bounced: false });
      this.spark(x, y, '#ffd98b', 5);
      this.event('cannon');
    }

    defeat(mob) {
      mob.defeated = true;
      this.score += 75;
      this.spark(mob.currentX + mob.w / 2, mob.currentY + mob.h / 2, '#e3b5ff', 11);
      this.event('hit');
    }

    updateShots(dt) {
      for (const shot of this.shots) {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.vy += (this.level.flight ? 0 : 300) * dt;
        shot.life -= dt;
        const col = Math.floor(shot.x / SIZE);
        const row = Math.floor(shot.y / SIZE) + 2;
        if (top(mask(this.level, col, row)) && shot.vy > 0) {
          shot.y = (row - 2) * SIZE - 2;
          shot.vy *= -.6;
        }
        for (const mob of this.monsters) {
          if (shot.life <= 0 || mob.defeated || mob.phased || !near(shot.x, mob.currentX + mob.w / 2, mob.w / 2 + 2) ||
              !near(shot.y, mob.currentY + mob.h / 2, mob.h / 2 + 2)) continue;
          shot.life = 0;
          if (mob.kind === 'cannon') this.spark(shot.x, shot.y, '#ffcb7c', 4);
          else if (--mob.hp === 0) this.defeat(mob);
        }
        for (const prop of this.props) {
          if (shot.life <= 0 || prop.type !== 17) continue;
          if (shot.x > prop.x && shot.x < prop.x + prop.w && shot.y > prop.y && shot.y < prop.y + prop.h) {
            this.toggle.add(prop.tag);
            shot.life = 0;
            this.spark(shot.x, shot.y, '#f0ab76', 10);
          }
        }
      }
      this.shots = this.shots.filter(shot => shot.life > 0);
      for (const shot of this.enemyShots) {
        const previousY = shot.y;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.vy += 218 * dt;
        shot.life -= dt;
        const col = Math.floor(shot.x / SIZE);
        const row = Math.floor((shot.y + BALL_RADIUS) / SIZE) + 2;
        const floor = (row - 2) * SIZE;
        const wallCol = Math.floor((shot.x + Math.sign(shot.vx) * BALL_RADIUS) / SIZE);
        const wallRow = Math.floor(shot.y / SIZE) + 2;
        if (sides(mask(this.level, wallCol, wallRow)) || shot.x < 0 || shot.x >= this.level.width) {
          shot.life = 0;
        } else if (shot.vy > 0 && previousY + BALL_RADIUS <= floor && top(mask(this.level, col, row))) {
          if (shot.bounced) shot.life = 0;
          else {
            shot.y = floor - BALL_RADIUS;
            shot.vy *= -.55;
            shot.bounced = true;
          }
        }
        if (shot.life > 0 && inside(this.player, { x: shot.x - BALL_RADIUS, y: shot.y - BALL_RADIUS,
          w: 2 * BALL_RADIUS, h: 2 * BALL_RADIUS })) {
          this.takeHit(shot.x);
          shot.life = 0;
        }
        if (shot.life <= 0) this.spark(shot.x, shot.y, '#b7a5ad', 4);
      }
      this.enemyShots = this.enemyShots.filter(shot => shot.life > 0);
    }

    throwMarble() {
      if (this.throwWait > 0 || (!this.level.flight && (!this.ammo || this.shots.length))) return;
      if (!this.level.flight) this.ammo--;
      this.throwWait = this.level.flight ? .22 : .33;
      const p = this.player;
      this.shots.push({
        x: p.x + p.face * 15, y: p.y - (p.duck ? 10 : 21), vx: p.face * 268,
        vy: this.level.flight ? 0 : -40, life: 1.5,
      });
      this.event('throw');
    }

    checkGate() {
      if (this.gateWait > 0 || this.finished) return;
      for (const gate of this.level.gates) {
        if (gate.entry || !inside(this.player, gate, gate.hidden ? 11 : 3)) continue;
        if (gate.hidden && this.level.number <= 25 && !this.keys.has('duck')) continue;
        if (this.level.number >= 98 || gate.value >= 98) this.travel(gate);
        else {
          this.finished = true;
          this.finishedTarget = gate.value;
          this.event('complete', { number: this.level.number, next: gate.value });
        }
        return;
      }
    }

    travel(gate) {
      const target = stage(gate.value);
      const entry = target.gates.find(other => other.entry && other.tag === gate.tag);
      const fields = ['level', 'pickups', 'blocks', 'monsters', 'props', 'time', 'toggle', 'checkpoint', 'checkpointAt'];
      if (target.number >= 98) {
        this.secrets.add(this.level.number + ':' + gate.tag);
        this.branch = Object.fromEntries(fields.map(key => [key, this[key]]));
        this.load(target.number, entry);
        this.event('secret', { number: target.number, entryTag: gate.tag });
      } else {
        if (this.branch?.level.number === target.number) {
          Object.assign(this, this.branch);
          this.branch = null;
          this.player = this.createPlayer(fromGate(target, entry));
          this.particles = [];
          this.outcomes = [];
          this.shots = [];
          this.enemyShots = [];
          this.gateWait = 1.1;
          this.release();
        } else this.load(target.number, entry);
        this.event('return', { number: target.number, entryTag: gate.tag });
      }
    }

    recordCheckpoint() {
      const p = this.player;
      if (!p.grounded || p.riding || this.level.flight || this.level.number >= 98) return;
      const marked = this.level.checkpoints.some(zone => inside(p, zone, 4));
      if (!marked && Math.abs(p.x - this.checkpointAt) < 480) return;
      if (marked && Math.abs(p.x - this.checkpointAt) < 24) return;
      const hold = x => localFloor(this.level, x, p.y - 1, 4) !== null;
      if (!hold(p.x - 14) || !hold(p.x + 14)) return;
      this.checkpoint = { x: p.x, y: p.y };
      this.checkpointAt = p.x;
    }

    spark(x, y, color, count) {
      for (let index = 0; index < count; index++) {
        const life = .22 + Math.random() * .36;
        this.particles.push({ x, y, vx: Math.random() * 87 - 43.5, vy: -Math.random() * 83, color, life, max: life });
      }
    }

    updateParticles(dt) {
      for (const particle of this.particles) {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 135 * dt;
      }
      this.particles = this.particles.filter(particle => particle.life > 0);
      for (const item of this.outcomes) {
        item.y += item.vy * dt;
        item.vy += 335 * dt;
        item.time -= dt;
      }
      this.outcomes = this.outcomes.filter(item => item.time > 0);
    }

    takeHit(from, dangerousTile = false) {
      const p = this.player;
      if (p.invulnerable > 0 || this.finished) return;
      if (dangerousTile || --this.health <= 0) {
        this.loseLife();
        return;
      }
      p.invulnerable = 1.17;
      p.vy = -105;
      p.vx = p.x < from ? -91 : 91;
      p.grounded = false;
      this.event('hurt');
      this.spark(p.x, p.y - 15, '#ff7782', 11);
    }

    loseLife() {
      if (--this.lives <= 0) {
        this.finished = true;
        this.event('gameover');
        return;
      }
      this.health = 5;
      for (const prop of this.props) {
        if (prop.type === 4) prop.crumbleAt = Infinity;
      }
      this.player = this.createPlayer(this.checkpoint);
      this.player.invulnerable = 1.45;
      this.shots = [];
      this.enemyShots = [];
      this.gateWait = .65;
      this.jumpBuffer = 0;
      this.event('respawn');
    }
  }

  globalThis.Charly = { Game, stage, clamp, near, at, rampHeight, SIZE, STEP, MAP_HEIGHT };
})();
