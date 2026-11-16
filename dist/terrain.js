(() => {
  'use strict';

  const { SIZE, at, rampHeight } = Charly;
  const tilePixels = 96;
  const CHUNK = SIZE * 8;
  const CACHE_SCALE = 4;
  const PAD = SIZE;
  const MAX_CHUNKS = 56;
  const RAMP_DEPTH = SIZE;
  const SURFACE_JOIN = 1.5;
  const rectangle = (bounds, x, y, w, h) =>
    x + w > bounds.x && x < bounds.right && y + h > bounds.y && y < bounds.bottom;
  const scenery = [
    { sheet: 1, x: 2, y: 6, w: 4, h: 5, art: 'canopy' },
    { sheet: 1, x: 6, y: 6, w: 4, h: 5, art: 'jungle-tree', crown: true },
    { sheet: 2, x: 6, y: 0, w: 4, h: 2, art: 'jungle-tree', roots: true },
    { sheet: 5, x: 12, y: 2, w: 8, h: 9, art: 'canopy' },
    { sheet: 1, x: 0, y: 8, w: 2, h: 3, art: 'mushrooms' },
    { sheet: 1, x: 10, y: 8, w: 3, h: 2, art: 'stump' },
    { sheet: 5, x: 0, y: 5, w: 8, h: 4, art: 'scree' },
  ];
  const masonry = [
    ['slate','slate','slate','clay','steel','steel','steel','slate','slate','slate','clay','steel','steel','steel','slate'],
    ['clay','clay','slate','clay','slate','steel','steel','clay','clay','slate','clay','clay','steel','steel','clay'],
  ];
  const flatTile = tile => ({
    sheet: tile < 880 ? 1 : tile < 1840 ? 2 : tile < 2720 ? 3 : tile < 3680 ? 4 : 5,
    row: Math.floor(tile / 80),
    col: Math.floor(tile / 2) % 20,
  });

  class Terrain {
    constructor(images) {
      this.images = images;
      this.objects = [];
      this.coveredTiles = new Set();
      this.cells = new Map();
      this.materials = new Map();
      this.blocks = new Map();
      this.chunks = new Map();
      this.occupied = new Set();
      this.level = null;
      this.slopeTiles = new Map();
      this.slopeEnds = new Map();
    }

    prepare(level) {
      if (this.level === level) return;
      this.level = level;
      for (const chunk of this.chunks.values()) chunk.close?.();
      this.chunks.clear();
      this.occupied.clear();
      this.slopeTiles.clear();
      this.slopeEnds.clear();
      const candidates = new Map();
      const details = new Map();
      this.objects = [];
      this.coveredTiles.clear();
      this.cells.clear();
      for (let row = 0; row < level.art.length; row++) {
        for (let col = 0; col < level.columns; col++) {
          const id = level.art[row][col];
          if (!id) continue;
          const { sheet, row: sourceRow, col: sourceCol } = flatTile(id);
          const local = sourceRow - [0, 0, 11, 23, 34, 46][sheet];
          const index = row * level.columns + col;
          const flag = at(level, col, row - 1) & 127;
          const shape = scenery.find(({ sheet: s, x, y, w, h, art }) =>
            s === sheet && sourceCol >= x && sourceCol < x + w && local >= y && local < y + h &&
            (art !== 'scree' || !flag));
          if (shape) {
            const left = col + shape.x - sourceCol;
            const top = row + shape.y - local;
            const key = shape.sheet + '/' + shape.x + '/' + left + '/' + top;
            const group = candidates.get(key) ?? { shape, left, top, cells: [] };
            group.cells.push(index);
            candidates.set(key, group);
          }
          const spikes = (sheet === 2 && local >= 5 && local <= 8) || (sheet === 4 && local >= 4 &&
            (local >= 5 || sourceCol >= 12));
          const hazard = flag === 7;
          const stone = sheet === 2 && local >= 9 && sourceCol < 15 ? masonry[local - 9][sourceCol] : null;
          const wood = (sheet === 1 && local >= 6 && sourceCol >= 12 && (local >= 8 || sourceCol >= 16)) ||
            (sheet === 2 && (local < 3 || (local < 5 && sourceCol >= 6)));
          const cloth = sheet === 5 && local >= 5 && sourceCol >= 8 && sourceCol < 12 ||
            sheet === 5 && local >= 9 && sourceCol < 8;
          const rock = !spikes && !stone && !wood && !cloth && !shape;
          this.cells.set(index, { spikes, hazard, stone, wood, rock, local });
          if (sheet === 1 && !shape && local === 4 && (id % 17 === 0 || sourceCol === 7) &&
              flag === 1 && col % 3 === 1) {
            const kind = col % 2 ? 'fern' : 'palm';
            details.set(index, { art: 'redrawn-' + kind, x: col * SIZE + 8, y: (row - 3) * SIZE + .6, w: 20, h: 18 });
          }
        }
      }
      const stamps = [...candidates.values()];
      for (const { cells } of stamps) {
        for (const cell of cells) this.coveredTiles.add(cell);
      }
      if (!level.flight) this.prepareSlopes(level);
      this.hideDetachedRocks(level);
      this.placeScenery(level, stamps);
      if (!level.flight) this.decorateGround(level);
      if (!level.snow && !level.flight) this.objects.push(...details.values());
      for (const [index, cell] of this.cells) {
        if (this.coveredTiles.has(index)) continue;
        const col = index % level.columns;
        const row = Math.floor(index / level.columns);
        const flag = at(level, col, row - 1);
        const collision = flag & 127;
        if (level.flight && (!collision || collision > 10)) continue;
        if (!cell.rock && !cell.stone && !cell.spikes && !(cell.wood && collision)) continue;
        const x = Math.floor(col * SIZE / CHUNK);
        const y = Math.floor((row - 3) * SIZE / CHUNK);
        const front = Boolean(flag & 128);
        this.occupied.add(this.chunkKey(x, y, front));
        if (cell.rock && (row - 3) * SIZE % CHUNK === 0) {
          this.occupied.add(this.chunkKey(x, y - 1, front));
        }
      }
      for (const { x, y, w, h } of this.objects) {
        for (let row = Math.floor((y - h) / CHUNK); row <= Math.floor((y + 2) / CHUNK); row++) {
          for (let col = Math.floor((x - w/2) / CHUNK); col <= Math.floor((x + w/2) / CHUNK); col++) {
            this.occupied.add(this.chunkKey(col, row, false));
          }
        }
      }
    }

    groundNear(level, x, base) {
      const col = Math.floor(x / SIZE);
      let best = null;
      let distance = Infinity;
      const consider = y => {
        const offset = Math.abs(y - base);
        if (offset > SIZE * 2 || offset >= distance) return;
        best = y;
        distance = offset;
      };
      for (let row = Math.ceil((base - SIZE * 2) / SIZE) + 3; row <= Math.floor((base + SIZE * 2) / SIZE) + 3; row++) {
        const flag = at(level, col, row - 1) & 127;
        if (flag === 1 || flag === 4 || flag === 5 || flag === 9 || flag === 10) consider((row - 3) * SIZE);
      }
      if (!level.flight) {
        for (const ramp of level.ramps) {
          if (x >= ramp.x && x <= ramp.x + ramp.w) consider(rampHeight(ramp, x));
        }
      }
      if (best !== null) return best;
      for (let row = Math.ceil((base - SIZE) / SIZE) + 3; row <= Math.floor((base + SIZE * 2) / SIZE) + 3; row++) {
        const index = row * level.columns + col;
        if (this.cells.get(index)?.rock && !this.coveredTiles.has(index) &&
            (!this.cells.get(index - level.columns)?.rock || this.coveredTiles.has(index - level.columns))) {
          consider((row - 3) * SIZE);
        }
      }
      return best;
    }

    placeScenery(level, stamps) {
      const crowns = [];
      const roots = stamps.filter(stamp => stamp.shape.roots);
      const usedRoots = new Set();
      for (const { shape, left, top, cells } of stamps) {
        if (shape.roots || cells.length < 2 && shape.art !== 'mushrooms') continue;
        const art = shape.art;
        const x = (left + shape.w / 2) * SIZE;
        const base = (top - 3 + shape.h) * SIZE;
        if (art === 'stump') {
          const support = cells.find(cell => (at(level, cell % level.columns, Math.floor(cell / level.columns) - 1) & 127) === 5);
          const platformY = support === undefined ? null : (Math.floor(support / level.columns) - 3) * SIZE;
          const y = this.groundNear(level, x, base) ?? base;
          const topY = platformY ?? y - 23;
          if (support !== undefined || cells.length >= 4) {
            this.objects.push({ art: 'redrawn-stump', x, y: Math.max(y, topY + SIZE), w: SIZE * 2.9, h: Math.max(SIZE, y - topY) });
          }
          continue;
        }
        if (art === 'scree') {
          if (cells.length >= 5) {
            const y = this.groundNear(level, x, base) ?? base;
            this.objects.push({ art: 'redrawn-scree', x, y, w: SIZE * 8, h: SIZE * 3.15 });
          }
          continue;
        }
        if (art === 'mushrooms') {
          this.objects.push({ art: 'redrawn-mushrooms', x, y: this.groundNear(level, x, base) ?? base, w: SIZE * 2, h: SIZE * 3 });
          continue;
        }
        let rootTiles = 0;
        let expectedY = base;
        if (shape.crown) {
          // This tree begins on the first sheet and its last two rows are on the next.
          let root = null;
          for (const candidate of roots) {
            const gap = candidate.top - top;
            if (!usedRoots.has(candidate) && candidate.left === left && gap >= 3 && gap <= 6 &&
                (!root || Math.abs(gap - 5) < Math.abs(root.top - top - 5))) root = candidate;
          }
          if (root) usedRoots.add(root);
          rootTiles = root?.cells.length ?? 0;
          expectedY = root ? (root.top - 1) * SIZE : base + 2 * SIZE;
        }
        const y = this.groundNear(level, x, expectedY);
        if (y === null) continue;
        const name = 'redrawn-' + (level.snow ? 'spruce' : art);
        const h = Math.max(SIZE * 3, y - (top - 3) * SIZE);
        const image = this.images[name];
        crowns.push({ art: name, x, y, w: Math.min((shape.w + .5) * SIZE, h * image.width / image.height), h,
          evidence: cells.length + rootTiles });
      }
      crowns.sort((a, b) => b.evidence - a.evidence);
      const trees = [];
      for (const tree of crowns) {
        if (trees.some(other => Math.abs(tree.x - other.x) < SIZE / 2 && Math.abs(tree.y - other.y) <= 2)) continue;
        trees.push(tree);
      }
      this.objects.push(...trees);
    }

    hideDetachedRocks(level) {
      const visited = new Set();
      const visibleRock = index => {
        if (!this.cells.get(index)?.rock || this.coveredTiles.has(index)) return false;
        const ramp = this.slopeTiles.get(index);
        if (!ramp) return true;
        const x = index % level.columns * SIZE;
        const bottom = (Math.floor(index / level.columns) - 2) * SIZE;
        return Math.min(rampHeight(ramp, x), rampHeight(ramp, x + SIZE)) < bottom;
      };
      for (const index of this.cells.keys()) {
        if (visited.has(index) || !visibleRock(index)) continue;
        visited.add(index);
        const group = [index];
        let anchored = false;
        for (let cursor = 0; cursor < group.length; cursor++) {
          const cell = group[cursor];
          const col = cell % level.columns;
          const row = Math.floor(cell / level.columns);
          if ((at(level, col, row - 1) & 127) || this.slopeTiles.has(cell)) anchored = true;
          for (const [nx, ny] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
            if (nx < 0 || nx >= level.columns || ny < 0 || ny >= level.art.length) continue;
            if (at(level, nx, ny - 1) & 127) anchored = true;
            const neighbor = ny * level.columns + nx;
            if (!visited.has(neighbor) && visibleRock(neighbor)) {
              visited.add(neighbor);
              group.push(neighbor);
            }
          }
        }
        if (!anchored && group.length <= 4) {
          for (const cell of group) this.coveredTiles.add(cell);
        }
      }
    }

    decorateGround(level) {
      const art = ['redrawn-fern', 'redrawn-palm', 'redrawn-mushrooms', 'redrawn-scree'];
      const sizes = [[25, 21], [22, 23], [19, 14], [34, 10]];
      const ground = [];
      for (let row = 4; row < level.art.length; row++) {
        for (let col = 2; col + 2 < level.columns; col++) {
          const index = row * level.columns + col;
          if (!this.cells.get(index)?.rock || this.coveredTiles.has(index) || this.slopeTiles.has(index)) continue;
          if (![col-1,col,col+1].every(x => (at(level, x, row - 1) & 127) === 1 ||
            (at(level, x, row - 1) & 127) === 5)) continue;
          if ((at(level, col, row - 2) & 127) || (at(level, col, row - 3) & 127) ||
              (at(level, col, row - 4) & 127)) continue;
          const hash = ((Math.imul(index + 1, 1597334677) ^ Math.imul(level.number, 3812015801)) >>> 0);
          if (hash % 17 !== 0) continue;
          const x = col * SIZE + SIZE / 2;
          const y = (row - 3) * SIZE;
          if (this.objects.some(o => Math.abs(x - o.x) < o.w / 2 + 19 && Math.abs(y - o.y) < 23) ||
              ground.some(o => Math.abs(x - o.x) < 43 && Math.abs(y - o.y) < 20) ||
              level.gates.some(o => x > o.x - 28 && x < o.x + o.w + 28 && Math.abs(y - o.y - o.h) < 48) ||
              level.props.some(o => x > o.x - 16 && x < o.x + o.w + 16 && Math.abs(y - o.y) < 24) ||
              level.pickups.some(o => Math.abs(x - o.x) < 18 && y - o.y >= 0 && y - o.y < 34)) continue;
          const kind = level.snow ? 3 : (hash >>> 6) % art.length;
          const [w, h] = sizes[kind];
          ground.push({ art: art[kind], x, y, w, h, groundDetail: true });
        }
      }
      this.objects.push(...ground);
    }

    prepareSlopes(level) {
      const distances = new Map();
      for (const ramp of level.ramps) {
        for (const x of [ramp.x, ramp.x + ramp.w]) {
          const col = Math.floor(x / SIZE);
          const ends = this.slopeEnds.get(col) ?? [];
          ends.push({ x, y: rampHeight(ramp, x) });
          this.slopeEnds.set(col, ends);
        }
        const right = ramp.x + ramp.w;
        const low = ramp.y + ramp.h;
        const firstCol = Math.max(0, Math.floor(ramp.x / SIZE));
        const lastCol = Math.min(level.columns - 1, Math.ceil(right / SIZE) - 1);
        for (let col = firstCol; col <= lastCol; col++) {
          const sampleX = Math.max(ramp.x, Math.min(right, col * SIZE + SIZE / 2));
          const surface = rampHeight(ramp, sampleX);
          const firstRow = Math.max(0, Math.floor((ramp.y - 32) / SIZE) + 3);
          const lastRow = Math.min(level.art.length - 1, Math.floor((surface + RAMP_DEPTH) / SIZE) + 3);
          for (let row = firstRow; row <= lastRow; row++) {
            const index = row * level.columns + col;
            if (!this.cells.get(index)?.rock || (at(level, col, row - 1) & 127)) continue;
            const { sheet, col: sourceCol, row: sourceRow } = flatTile(level.art[row][col]);
            const slopeArt = sheet === 3 || sheet === 4 || (sheet === 5 && sourceRow <= 50 && sourceCol < 12);
            if (!slopeArt) continue;
            const tileMid = (row - 3) * SIZE + SIZE / 2;
            const distance = Math.abs(tileMid - surface);
            if (distance >= (distances.get(index) ?? Infinity)) continue;
            distances.set(index, distance);
            this.slopeTiles.set(index, ramp);
          }
        }
        for (let row = Math.floor(ramp.y / CHUNK); row <= Math.floor((low + RAMP_DEPTH) / CHUNK); row++) {
          for (let col = Math.floor(ramp.x / CHUNK); col <= Math.floor(right / CHUNK); col++) {
            this.occupied.add(this.chunkKey(col, row, false));
          }
        }
      }
    }

    trimSlopeTile(path, x, y, ramp) {
      const right = x + SIZE;
      const bottom = y + SIZE + .03;
      const rampRight = ramp.x + ramp.w;
      const breaks = [x, right];
      for (const edge of [ramp.x, rampRight]) {
        if (edge > x && edge < right) breaks.push(edge);
      }
      if (ramp.h > 0) {
        for (const height of [y, bottom]) {
          const part = (height - ramp.y) / ramp.h;
          if (part <= 0 || part >= 1) continue;
          const crossing = ramp.x + ramp.w * (ramp.hidden ? part : 1 - part);
          if (crossing > x && crossing < right) breaks.push(crossing);
        }
      }
      breaks.sort((a, b) => a - b);
      for (let i = 1; i < breaks.length; i++) {
        const left = breaks[i - 1];
        const end = breaks[i];
        if (left === end || rampHeight(ramp, (left + end) / 2) >= bottom) continue;
        path.moveTo(left, Math.max(y, rampHeight(ramp, left)));
        path.lineTo(end, Math.max(y, rampHeight(ramp, end)));
        path.lineTo(end, bottom);
        path.lineTo(left, bottom);
        path.closePath();
      }
    }

    paintSlopes(rock, cap, rim, level, bounds) {
      if (level.flight) return;
      for (const ramp of level.ramps) {
        if (!rectangle(bounds, ramp.x, ramp.y, ramp.w, ramp.h + RAMP_DEPTH)) continue;
        const left = ramp.x - SURFACE_JOIN;
        const right = ramp.x + ramp.w + SURFACE_JOIN;
        const leftY = rampHeight(ramp, left);
        const rightY = rampHeight(ramp, right);
        const band = level.snow ? 4.7 : 4.4;
        for (const [path, depth] of [[rock, RAMP_DEPTH], [cap, band]]) {
          path.moveTo(left, leftY);
          path.lineTo(right, rightY);
          path.lineTo(right, rightY + depth);
          path.lineTo(left, leftY + depth);
          path.closePath();
        }
        rim.moveTo(left, leftY + .3);
        rim.lineTo(right, rightY + .3);
      }
    }

    chunkKey(x, y, front) {
      return x + '/' + y + '/' + Number(front);
    }

    getChunk(x, y, front) {
      const key = this.chunkKey(x, y, front);
      if (!this.occupied.has(key)) return null;
      if (this.chunks.has(key)) {
        const image = this.chunks.get(key);
        this.chunks.delete(key);
        this.chunks.set(key, image);
        return image;
      }
      const size = CHUNK + PAD * 2;
      const pixels = size * CACHE_SCALE;
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(pixels, pixels) : document.createElement('canvas');
      if (canvas.width !== pixels) canvas.width = pixels;
      if (canvas.height !== pixels) canvas.height = pixels;
      const ctx = canvas.getContext('2d');
      const camera = { x: x * CHUNK - PAD, y: y * CHUNK - PAD };
      ctx.setTransform(CACHE_SCALE, 0, 0, CACHE_SCALE, -camera.x * CACHE_SCALE, -camera.y * CACHE_SCALE);
      const section = {
        ctx, camera, width: size, height: size,
        visible: (x, y, w, h) => x + w >= camera.x && x <= camera.x + size &&
          y + h >= camera.y && y <= camera.y + size,
      };
      if (!front) this.drawScenery(section);
      this.paintTiles(section, this.level, front, CACHE_SCALE);
      const image = canvas.transferToImageBitmap ? canvas.transferToImageBitmap() : canvas;
      this.chunks.set(key, image);
      if (this.chunks.size > MAX_CHUNKS) {
        const oldest = this.chunks.keys().next().value;
        this.chunks.get(oldest).close?.();
        this.chunks.delete(oldest);
      }
      return image;
    }

    drawTiles({ ctx, camera, width, height }, front, scale) {
      const lastCol = Math.floor((camera.x + width) / CHUNK);
      const lastRow = Math.floor((camera.y + height) / CHUNK);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const inset = PAD * CACHE_SCALE;
      const pixels = CHUNK * CACHE_SCALE;
      for (let row = Math.floor(camera.y / CHUNK); row <= lastRow; row++) {
        const top = Math.round((row * CHUNK - camera.y) * scale);
        const bottom = Math.round(((row + 1) * CHUNK - camera.y) * scale);
        for (let col = Math.floor(camera.x / CHUNK); col <= lastCol; col++) {
          const image = this.getChunk(col, row, front);
          if (!image) continue;
          const left = Math.round((col * CHUNK - camera.x) * scale);
          const right = Math.round(((col + 1) * CHUNK - camera.x) * scale);
          ctx.drawImage(image, inset, inset, pixels, pixels, left, top, right - left, bottom - top);
        }
      }
      ctx.restore();
    }

    drawScenery(renderer) {
      const { ctx } = renderer;
      for (const { art, x, y, w, h } of this.objects) {
        if (renderer.visible(x - w / 2, y - h, w, h)) {
          const inset = art === 'redrawn-stump' ? 0 : 1.4;
          ctx.drawImage(this.images[art], x - w / 2, y - h + inset, w, h);
        }
      }
    }

    paintTiles({ ctx, camera, width, height }, level, front, scale) {
      const firstCol = Math.max(0, Math.floor(camera.x / SIZE) - 1);
      const lastCol = Math.min(level.columns, Math.ceil((camera.x + width) / SIZE) + 1);
      const firstRow = Math.max(0, Math.floor(camera.y / SIZE) + 2);
      const lastRow = Math.min(level.art.length, Math.ceil((camera.y + height) / SIZE) + 4);
      const rock = new Path2D();
      const cap = new Path2D();
      const recess = new Path2D();
      const rim = new Path2D();
      const fixtures = [];
      const cellAt = (col, row) => col >= 0 && col < level.columns && this.cells.get(row * level.columns + col);
      const solid = (col,row) => {
        const cell = cellAt(col,row);
        const index = row * level.columns + col;
        return !this.coveredTiles.has(index) && !this.slopeTiles.has(index) && (cell?.rock || cell?.stone);
      };
      for (let row = firstRow; row < lastRow; row++) {
        const y = (row - 3) * SIZE;
        for (let col = firstCol; col < lastCol; col++) {
          const cell = cellAt(col,row);
          if (!cell || this.coveredTiles.has(row * level.columns + col)) continue;
          const flag = at(level, col, row - 1);
          if (!!(flag & 128) !== front) continue;
          const collision = flag & 127;
          if (level.flight && (!collision || collision > 10)) continue;
          const x = col * SIZE;
          if (!cell.rock) {
            fixtures.push({ x, y, row, col, cell, flag });
            continue;
          }
          const slope = this.slopeTiles.get(row * level.columns + col);
          if (slope) {
            this.trimSlopeTile(rock, x, y, slope);
            continue;
          }
          const topLeft = y;
          const topRight = y;
          const open = !solid(col,row-1);
          const joinsSlope = x => {
            const endCol = Math.floor(x / SIZE);
            return [-1, 0].some(offset => this.slopeEnds.get(endCol + offset)?.some(end =>
              Math.abs(end.x - x) <= 3 && Math.abs(end.y - y) <= 3));
          };
          const leftRadius = open && !solid(col-1,row) && !joinsSlope(x) ? 2.25 : 0;
          const rightRadius = open && !solid(col+1,row) && !joinsSlope(x + SIZE) ? 2.25 : 0;
          const bottom = y + SIZE + .03;
          rock.moveTo(x, Math.min(bottom,topLeft + leftRadius));
          rock.quadraticCurveTo(x,topLeft,x + leftRadius,topLeft);
          rock.lineTo(x + SIZE - rightRadius,topRight);
          rock.quadraticCurveTo(x + SIZE,topRight,x + SIZE,Math.min(bottom,topRight + rightRadius));
          rock.lineTo(x + SIZE,bottom);
          rock.lineTo(x,bottom);
          rock.closePath();
          if (!collision && !this.slopeTiles.has((row - 1) * level.columns + col) &&
              ![1, 4, 5, 9, 10].includes(at(level, col, row - 2) & 127)) {
            recess.rect(x, y, SIZE, SIZE + .03);
          }
          if (open && [1, 4, 5, 9, 10].includes(collision)) {
            const depth = level.snow ? 4.7 : 4.4;
            cap.moveTo(x,topLeft + leftRadius);
            cap.quadraticCurveTo(x,topLeft,x + leftRadius,topLeft);
            cap.lineTo(x + SIZE - rightRadius,topRight);
            cap.quadraticCurveTo(x + SIZE,topRight,x + SIZE,topRight + rightRadius);
            cap.lineTo(x + SIZE,topRight + depth + .8 * Math.sin((x+SIZE)*.14));
            cap.quadraticCurveTo(x + 7, (topLeft + topRight) / 2 + depth * 1.4,
              x,topLeft + depth + .8 * Math.sin(x*.14));
            cap.closePath();
            rim.moveTo(x + leftRadius,topLeft + .3);
            rim.lineTo(x + SIZE - rightRadius,topRight + .3);
          }
        }
      }
      if (!front) this.paintSlopes(rock, cap, rim, level, {
        x: camera.x, y: camera.y, right: camera.x + width, bottom: camera.y + height,
      });
      ctx.save();
      if (front) ctx.globalAlpha = .88;
      const stone = level.snow ? 'frost' : 'basalt';
      ctx.fillStyle = this.pattern(ctx,stone,103);
      ctx.fill(rock);
      ctx.save();
      ctx.clip(rock);
      ctx.save();
      ctx.fillStyle = '#100e2070';
      ctx.filter = 'blur(7px)';
      ctx.fill(recess);
      ctx.restore();
      ctx.fillStyle = this.pattern(ctx,level.snow ? 'frost' : 'moss',61);
      ctx.fill(cap);
      ctx.strokeStyle = level.snow ? '#c8e5f8c0' : '#c9ac6e76';
      ctx.lineWidth = .6;
      ctx.stroke(rim);
      ctx.restore();
      ctx.setTransform(1,0,0,1,0,0);
      for (const {x,y,col,row,cell,flag} of fixtures) {
        const left = Math.round((x - camera.x)*scale);
        const top = Math.round((y - camera.y)*scale);
        const w = Math.round((x + SIZE - camera.x)*scale)-left;
        const h = Math.round((y + SIZE - camera.y)*scale)-top;
        if (cell.spikes && cell.hazard) this.drawSpikes(ctx,level,col,row,left,top,w,h);
        else if (cell.stone || cell.spikes && (flag & 127) === 4) {
          ctx.drawImage(this.block(cell.stone || 'steel',cell.local === 10),left,top,w,h);
        } else if (cell.wood && (flag & 127)) {
          ctx.save();
          ctx.translate(left,top);
          ctx.scale(w/16,h/16);
          const height = (flag & 127) === 1 ? 5 : 16;
          this.beam(ctx,height);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    pattern(ctx,name,size) {
      const key = name + '/' + size;
      if (!this.materials.has(key)) {
        const image = this.images['material-' + name];
        const pattern = ctx.createPattern(image,'repeat');
        pattern.setTransform(new DOMMatrix().scale(size / image.width,size / image.height));
        this.materials.set(key, pattern);
      }
      return this.materials.get(key);
    }

    beam(ctx,height) {
      const wood = ctx.createLinearGradient(0,0,0,height);
      wood.addColorStop(0,'#c89666');
      wood.addColorStop(.18,'#825139');
      wood.addColorStop(1,'#3c2224');
      ctx.fillStyle = wood;
      ctx.fillRect(0,0,16,height);
      ctx.fillStyle = '#e6af7469';
      ctx.fillRect(0,.5,16,.5);
      ctx.fillStyle = '#d3a378';
      ctx.beginPath();
      ctx.arc(3,Math.min(2,height/2),.65,0,Math.PI*2);
      ctx.fill();
    }

    block(name, alternate) {
      const key = name + alternate;
      if (this.blocks.has(key)) return this.blocks.get(key);
      const tile = document.createElement('canvas');
      tile.width = tile.height = tilePixels;
      const ctx = tile.getContext('2d');
      const image = this.images['material-' + name];
      ctx.fillStyle = '#191521';
      ctx.fillRect(0, 0, 96, 96);
      ctx.beginPath();
      ctx.roundRect(1, 1, 94, 94, 5);
      ctx.save();
      ctx.clip();
      const sample = Math.min(image.width, image.height) * .68;
      const offset = alternate ? image.width - sample : 0;
      ctx.drawImage(image, offset, alternate ? image.height - sample : 0, sample, sample, 0,0,96,96);
      const bevel = ctx.createLinearGradient(0,0,0,96);
      bevel.addColorStop(0, '#ffe1ae82');
      bevel.addColorStop(.09, '#f8c28a00');
      bevel.addColorStop(.75, '#1b142400');
      bevel.addColorStop(1, '#1b1424a6');
      ctx.fillStyle = bevel;
      ctx.fillRect(0,0,96,96);
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#392d41';
      ctx.stroke();
      this.blocks.set(key,tile);
      return tile;
    }

    drawSpikes(ctx, level, col, row, left, top, w, h) {
      const solid = (x,y) => {
        const flag = at(level,x,y-1) & 127;
        return flag >= 1 && flag <= 6 || flag === 9 || flag === 10;
      };
      const tile = this.block('steel', (col + row) % 2 === 0);
      ctx.save();
      ctx.translate(left + w / 2, top + h / 2);
      ctx.scale(w / 16, h / 16);
      if (solid(col,row-1)) ctx.rotate(Math.PI);
      else if (!solid(col,row+1) && solid(col-1,row)) ctx.rotate(Math.PI / 2);
      else if (!solid(col,row+1) && solid(col+1,row)) ctx.rotate(-Math.PI / 2);
      const steel = ctx.createLinearGradient(-8,0,8,0);
      steel.addColorStop(0,'#89798d');
      steel.addColorStop(.36,'#f2dfcf');
      steel.addColorStop(.53,'#c7b4bf');
      steel.addColorStop(1,'#4d4259');
      ctx.fillStyle = steel;
      ctx.strokeStyle = '#312637';
      ctx.lineWidth = .32;
      for (const x of [-5.1, 0, 5.1]) {
        ctx.beginPath();
        ctx.moveTo(x - 2.5, 6);
        ctx.lineTo(x - .35, -7.5 + Math.abs(x) * .17);
        ctx.lineTo(x + 2.45, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.drawImage(tile, -8, 5.4, 16, 2.6);
      ctx.restore();
    }
  }

  Charly.Terrain = Terrain;
})();
