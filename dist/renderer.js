(() => {
  'use strict';

  const { MAP_HEIGHT, clamp, Terrain } = Charly;
  const portrait = ['idle', 'jump', 'duck'].map(pose => 'charly-' + pose);
  const sprites = ['ghost', 'cannon', 'rock', 'plane', 'bottle', 'ruby', 'beam', 'spring',
    'ball', 'canopy', 'jungle-tree', 'spruce', 'fern', 'mushrooms', 'palm', 'stump', 'scree'];
  const images = [
    ...portrait, 'animation', 'crawler', 'jungle',
    'vista-4', 'vista-5', 'vista-6', 'vista-7',
    ...sprites.map(name => 'redrawn-' + name),
    ...['basalt', 'slate', 'clay', 'steel', 'frost', 'moss'].map(name => 'material-' + name),
  ];

  function loadImage(name) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load artwork: ' + name));
      image.src = 'assets/' + name + '.webp';
    });
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const backdrop = canvas.closest('.game-slot')?.querySelector('.game-backdrop');
      this.backdrop = backdrop?.querySelector('img');
      this.backdropTint = backdrop?.querySelector('.backdrop-tint');
      this.backdropView = null;
      this.ctx = canvas.getContext('2d', { alpha: Boolean(backdrop) });
      this.images = {};
      this.height = 216;
      this.width = 430;
      this.camera = { x: 0, y: 0 };
      this.level = null;
      this.terrain = new Terrain(this.images);
      this.lightMask = null;
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    async load() {
      await Promise.all(images.map(async name => { this.images[name] = await loadImage(name); }));
    }

    resize() {
      const { width: cssWidth, height: cssHeight } = this.canvas.getBoundingClientRect();
      if (!cssWidth || !cssHeight) return;
      const density = Math.min(window.devicePixelRatio || 1, 2.5);
      const fullscreen = document.body.classList.contains('desktop-fullscreen');
      const scale = fullscreen ? Math.max(1080 / cssHeight, 1920 / cssWidth) : Math.min(density, 1080 / cssHeight);
      const pixelWidth = Math.round(cssWidth * scale);
      const pixelHeight = Math.round(cssHeight * scale);
      this.width = this.height * pixelWidth / pixelHeight;
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
      }
    }

    resetCamera() {
      this.level = null;
    }

    frame(game, dt) {
      const ctx = this.ctx;
      const p = game.player;
      const snap = this.level !== game.level;
      if (snap) {
        this.level = game.level;
        this.terrain.prepare(game.level);
        this.prepareChains(game.level.props);
      }
      const targetX = clamp(p.x - this.width * .42 + p.vx * .19, 0, game.level.width - this.width);
      const targetY = clamp(p.y - (game.level.flight ? 112 : 151), 0, MAP_HEIGHT - this.height + 10);
      this.camera.x += (targetX - this.camera.x) * (snap ? 1 : Math.min(1, dt * 7));
      this.camera.y += (targetY - this.camera.y) * (snap ? 1 : Math.min(1, dt * 6));
      const scale = this.canvas.height / this.height;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingQuality = 'low';
      if (this.backdrop) ctx.clearRect(0, 0, this.width, this.height);
      this.background(game);
      ctx.save();
      ctx.translate(-this.camera.x, -this.camera.y);
      this.terrain.drawTiles(this, false, scale);
      this.drawChains();
      this.props(game);
      this.drawGates(game);
      this.objects(game);
      this.hero(game);
      this.terrain.drawTiles(this, true, scale);
      this.hint(game);
      ctx.restore();
      this.light(game);
    }

    background(game) {
      const ctx = this.ctx;
      const level = game.level;
      const image = this.images[level.vista ? 'vista-' + level.vista : 'jungle'];
      const progress = this.camera.x / level.width;
      const viewW = Math.min(image.width * .91, Math.max(image.width * .6, this.width * 2.5));
      const viewH = Math.min(image.height, viewW * this.height / this.width);
      const color = level.snow ? '#292c61' : level.number >= 98 ? '#1c133b' : '#190a23';
      if (this.backdrop) {
        const view = this.backdropView;
        if (view?.image !== image || view?.width !== viewW || view?.height !== viewH || view?.color !== color) {
          if (this.backdrop.src !== image.src) this.backdrop.src = image.src;
          this.backdrop.style.width = (image.width / viewW * 100) + '%';
          this.backdrop.style.height = (image.height / viewH * 100) + '%';
          this.backdropTint.style.backgroundImage = 'linear-gradient(' + color + '12,' + color + '22 65%,' + color + '95)';
          this.backdropView = { image, width: viewW, height: viewH, color };
        }
        const scroll = -(1 - viewW / image.width) * progress * 100;
        this.backdrop.style.transform = 'translate3d(' + scroll + '%,0,0)';
        return;
      }
      ctx.drawImage(image, (image.width - viewW) * progress, 0, viewW, viewH, 0, 0, this.width, this.height);
      const wash = ctx.createLinearGradient(0, 0, 0, this.height);
      wash.addColorStop(0, color + '12');
      wash.addColorStop(.65, color + '22');
      wash.addColorStop(1, color + '95');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    sprite(name, x, y, w, h, mirror = false, tilt = 0) {
      const { ctx } = this;
      const art = this.images['redrawn-' + (name === 'cannonball' ? 'ball' : name)];
      const fit = Math.min(w / art.width, h / art.height);
      ctx.save();
      ctx.translate(x + w / 2, y + h);
      if (mirror) ctx.scale(-1, 1);
      ctx.rotate(tilt);
      ctx.drawImage(art, -art.width * fit / 2, -art.height * fit, art.width * fit, art.height * fit);
      ctx.restore();
    }

    animation(name, phase, x, y, size, mirrored = false) {
      const frames = CharlyAnimation[name];
      const [sx, sy] = frames[Math.floor(phase) % frames.length];
      const { ctx } = this;
      const edge = 192;
      if (mirrored) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(-1, 1);
        ctx.drawImage(this.images.animation, sx, sy, edge, edge, -size / 2, -size, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(this.images.animation, sx, sy, edge, edge, x - size / 2, y - size, size, size);
      }
    }

    rolling(name, x, y, w, h, angle) {
      const { ctx } = this;
      const art = this.images['redrawn-' + name];
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(angle);
      ctx.drawImage(art, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    aircraft(p, time) {
      const { ctx } = this;
      const art = this.images['redrawn-plane'];
      const w = 40;
      const h = w * art.height / art.width;
      ctx.save();
      ctx.translate(p.x, p.y - 12.8);
      ctx.scale(p.face, 1);
      ctx.rotate(clamp(p.vy / 720, -.20, .20) * p.face);
      ctx.drawImage(art, -w / 2, -h / 2, w, h);
      const phase = time * 65;
      ctx.strokeStyle = '#ffc98565';
      ctx.lineWidth = .9;
      ctx.beginPath();
      ctx.ellipse(18, -1, 1.25 + Math.abs(Math.cos(phase)), 8.5, 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    hardware(x, y, w, h, metal = true) {
      const { ctx } = this;
      const fill = ctx.createLinearGradient(x, y, x, y + h);
      fill.addColorStop(0, metal ? '#edba82' : '#d1a071');
      fill.addColorStop(.24, metal ? '#857477' : '#875542');
      fill.addColorStop(.61, metal ? '#413849' : '#653a33');
      fill.addColorStop(1, '#231923');
      ctx.beginPath();
      ctx.roundRect(x + .2, y + .2, w - .4, h - .4, Math.min(2.5, h / 3));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = '#221923';
      ctx.lineWidth = .55;
      ctx.stroke();
      ctx.fillStyle = '#ffd6a6';
      for (let i = 3; i < w - 2; i += 10) {
        ctx.beginPath();
        ctx.arc(x + i, y + h * .45, Math.min(.9,h * .17), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    water(x, y, w, h, time) {
      const { ctx } = this;
      const depth = Math.min(24, h);
      const fill = ctx.createLinearGradient(x, y, x, y + depth);
      fill.addColorStop(0, '#79e4df');
      fill.addColorStop(.16, '#398cb7cd');
      fill.addColorStop(.75, '#19356aee');
      fill.addColorStop(1, '#171e4690');
      const wave = wx => y + 3 + Math.sin(wx * .18 + time * 5) * 1.4 + Math.sin(wx * .43 + time * 3) * .45;
      ctx.beginPath();
      ctx.moveTo(x, wave(x));
      for (let px = 3; px < w; px += 3) ctx.lineTo(x + px, wave(x + px));
      ctx.lineTo(x + w, wave(x + w));
      ctx.lineTo(x + w, y + depth);
      ctx.lineTo(x, y + depth);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    timber(x, y, w, h, frame) {
      if (!frame) {
        this.sprite('beam', x, y, w, h);
        return;
      }
      const { ctx } = this;
      const art = this.images['redrawn-beam'];
      const progress = frame / 7;
      const height = w * art.height / art.width;
      const slice = art.width / 3;
      ctx.save();
      ctx.globalAlpha *= 1 - progress;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(x + (i + .5) * w / 3 + (i - 1) * progress * 5,
          y + h - height / 2 + progress * progress * (10 + i * 3));
        ctx.rotate((i - 1) * progress * .68);
        ctx.drawImage(art, i * slice, 0, slice, art.height, -w / 6, -height / 2, w / 3, height);
        ctx.restore();
      }
      ctx.restore();
    }

    prepareChains(props) {
      this.chains = [];
      const pieces = props.filter(prop => prop.type === 12).sort((a, b) => a.y - b.y || a.x - b.x);
      for (const { x, y, w } of pieces) {
        const previous = this.chains.at(-1);
        if (previous && previous.y === y && x <= previous.right + 2) {
          previous.right = Math.max(previous.right, x + w);
        } else {
          this.chains.push({ x, y, right: x + w });
        }
      }
      for (const span of this.chains) {
        span.anchors = props.filter(prop => prop.type === 10 && Math.abs(prop.y - span.y) <= 5 &&
          prop.x >= span.x + 8 && prop.x <= span.right - 8).map(prop => prop.x + prop.w / 2);
      }
    }

    drawChains() {
      for (const { x, y, right, anchors } of this.chains) {
        if (this.visible(x - 5, y - 7, right - x + 10, 18)) this.chain(x, y, right - x, anchors);
      }
    }

    chain(x, y, width, anchors) {
      const { ctx } = this;
      const stop = x + width;
      const steel = ctx.createLinearGradient(x, y - 2, x, y + 7);
      steel.addColorStop(0, '#fff3d4');
      steel.addColorStop(.26, '#c4a07c');
      steel.addColorStop(.55, '#766563');
      steel.addColorStop(1, '#413743');
      const count = Math.max(1, Math.round(width / 8));
      const spacing = width / count;
      const first = Math.max(0, Math.floor((this.camera.x - x) / spacing) - 2);
      const last = Math.min(count, Math.ceil((this.camera.x + this.width - x) / spacing) + 2);
      const linkY = index => y + 1.2 + Math.sin(index / count * Math.PI);
      ctx.save();
      ctx.lineJoin = 'round';
      for (const parity of [0, 1]) {
        ctx.beginPath();
        for (let i = first; i < last; i++) {
          if (i % 2 !== parity) continue;
          const cx = x + (i + .5) * spacing;
          const cy = linkY(i + .5);
          const h = parity ? 2.2 : 5.3;
          ctx.roundRect(cx - spacing * .62, cy - h / 2, spacing * 1.24, h, h / 2);
        }
        ctx.strokeStyle = '#201925';
        ctx.lineWidth = 2.9;
        ctx.stroke();
        ctx.strokeStyle = steel;
        ctx.lineWidth = 1.58;
        ctx.stroke();
      }
      for (const cx of [x + .5, ...anchors, stop - .5]) {
        if (!this.visible(cx - 5, y - 6, 10, 12)) continue;
        const cy = linkY((cx - x) / spacing);
        ctx.beginPath();
        ctx.roundRect(cx - 2.6, cy - 4.3, 5.2, 8.8, 1.6);
        ctx.fillStyle = '#2b202c';
        ctx.fill();
        ctx.strokeStyle = steel;
        ctx.lineWidth = .85;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy - .4, 1.25, 0, 2 * Math.PI);
        ctx.fillStyle = '#d7b48e';
        ctx.fill();
      }
      ctx.restore();
    }

    props(game) {
      const ctx = this.ctx;
      const phase = game.time;
      for (const prop of game.props) {
        const { type, currentX: x, currentY: y, w, h } = prop;
        if (!this.visible(x, y, w, h)) continue;
        if (type === 7) {
          const since = phase - prop.sprungAt;
          const compression = since < .24 ? (1 - since / .24) * .48 : 0;
          this.sprite('spring', x, y + h * compression, w, h * (1 - compression));
        } else if (type === 8) {
          this.rolling('ball', x, y, w, h, (x - prop.x) * 2 / w);
        } else if (type === 16) {
          this.hardware(x, y, w, Math.min(h, 10));
          this.hardware(x + w * .22, y + 9, w * .56, Math.min(h - 9, 10));
        } else if (type === 14) {
          this.water(x, y, w, h, phase);
        } else if (type === 4) {
          const frame = game.woodFrame(prop);
          if (frame < 7) this.timber(x, y, w, h, frame);
        } else if (type === 5 || (type === 13 && w < 120)) {
          this.hardware(x, y, w, Math.min(h, type === 5 ? 12 : 6));
        } else if (type === 15) {
          this.flame(prop, phase);
        } else if (type === 17 && game.supports(prop)) {
          const stone = this.terrain.block('steel', prop.id % 2 === 0);
          for (let dx = 0; dx < w; dx += 16) {
            ctx.drawImage(stone, x + dx, y, Math.min(16, w - dx), h);
          }
        }
      }
    }

    flame(prop, time) {
      const ctx = this.ctx;
      const { x, y, w, h, active, warning } = prop;
      const bottom = y + h;
      ctx.fillStyle = '#4f2b30';
      ctx.fillRect(x + 3,bottom - 3,w - 6,3);
      if (!active && !warning) return;
      const height = active ? h : 8;
      const color = ctx.createLinearGradient(x,bottom - height,x,bottom);
      color.addColorStop(0,'#e64b2800');
      color.addColorStop(.45,'#f25539d9');
      color.addColorStop(.79,'#ffa14f');
      color.addColorStop(1,'#fff59f');
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + 2,bottom);
      for (let i = 0; i <= 5; i++) {
        const phase = Math.sin(time * 21 + i * 2 + prop.id);
        ctx.quadraticCurveTo(x + w * (i + .22) / 6,bottom - height * (.68 + .25 * phase),
          x + w * (i + 1) / 6,bottom - height * (.44 + .16 * phase));
      }
      ctx.lineTo(x + w - 2,bottom);
      ctx.closePath();
      ctx.fill();
    }

    drawGates(game) {
      for (const gate of game.level.gates) {
        if (gate.entry || !this.visible(gate.x, gate.y, gate.w, gate.h)) continue;
        if (gate.hidden && game.level.number <= 25 && gate.variant !== 5) continue;
        const ctx = this.ctx;
        if (gate.w >= 80 && !gate.hidden) {
          this.tent(gate);
          continue;
        }
        const cx = gate.x + gate.w / 2;
        const ground = gate.y + gate.h;
        const width = Math.min(gate.w, gate.hidden ? 33 : 34);
        const h = Math.min(gate.h, gate.hidden ? 35 : 40);
        const sign = gate.hidden ? '#bbade5' : '#ffcf7b';
        const fill = ctx.createLinearGradient(cx - width / 2,ground-h,cx + width / 2,ground);
        fill.addColorStop(0, gate.hidden ? '#543657' : '#7a4742');
        fill.addColorStop(1, '#211527');
        ctx.fillStyle = fill;
        ctx.strokeStyle = sign;
        ctx.lineWidth = .85;
        ctx.beginPath();
        ctx.roundRect(cx - width/2,ground-h,width,h - 1,[4,4,1,1]);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#110d1c';
        ctx.fillRect(cx - width*.38,ground-h+6,width*.76,h * .44);
        ctx.fillStyle = sign;
        ctx.textAlign = 'center';
        ctx.font = '800 ' + (gate.hidden ? 5.5 : 6.4) + 'px system-ui';
        ctx.fillText(gate.hidden ? 'BONUS' : 'EXIT',cx,ground-h+12);
        ctx.fillStyle = gate.hidden ? '#a488d0' : '#e6874e';
        ctx.fillRect(cx - 3,ground-h+18,6,1.4);
      }
    }

    tent(gate) {
      const ctx = this.ctx;
      const x = gate.x + gate.w / 2;
      const y = gate.y + gate.h;
      const width = Math.min(97, gate.w);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(width / 88, 1);
      const aura = ctx.createRadialGradient(0, -24, 0, 0, -24, 64);
      aura.addColorStop(0, '#ffaf4b73');
      aura.addColorStop(1, '#ff824800');
      ctx.fillStyle = aura;
      ctx.fillRect(-68, -88, 136, 104);
      for (let i = -4; i < 4; i++) {
        const edge = i * 11;
        const red = i % 2 === 0;
        const silk = ctx.createLinearGradient(edge, -47, edge + 10, -3);
        silk.addColorStop(0, red ? '#ffd7ba' : '#fff2c8');
        silk.addColorStop(.52, red ? '#c9425a' : '#e5baa2');
        silk.addColorStop(1, red ? '#641837' : '#925b61');
        ctx.fillStyle = silk;
        ctx.beginPath();
        ctx.moveTo(i, -54);
        ctx.quadraticCurveTo(edge * .51, -30, edge, -20);
        ctx.lineTo(edge, 0);
        ctx.lineTo(edge + 11, 0);
        ctx.lineTo(edge + 11, -20);
        ctx.quadraticCurveTo((edge + 11) * .53, -31, i+1, -54);
        ctx.fill();
      }
      ctx.strokeStyle = '#ffc765';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-44, -20);
      ctx.lineTo(44, -20);
      ctx.stroke();
      const door = ctx.createLinearGradient(0, -20, 0, 0);
      door.addColorStop(0,'#2b142c');
      door.addColorStop(1,'#da7255');
      ctx.fillStyle = door;
      ctx.beginPath();
      ctx.roundRect(-9, -20, 18, 20, [8, 8, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#fcd375';
      ctx.fillRect(-.5, -62, 1, 12);
      ctx.beginPath();
      ctx.moveTo(0, -62);
      ctx.lineTo(13, -60);
      ctx.lineTo(0, -56);
      ctx.fill();
      ctx.restore();
    }

    objects(game) {
      const ctx = this.ctx;
      for (const pickup of game.pickups) {
        if (pickup.collected || !this.visible(pickup.x, pickup.y, pickup.w, pickup.h)) continue;
        const x = pickup.x + pickup.w/2;
        const propY = pickup.y + pickup.h/2 + Math.sin(game.time * 3 + pickup.x * .06) * 1.35;
        if (pickup.kind === 'coin') this.coin(x, propY, game.time * 4 + pickup.x * .035);
        else if (pickup.kind === 'bottle') this.sprite('bottle', pickup.x, propY - pickup.h / 2, pickup.w, pickup.h);
        else if (pickup.kind === 'bonus') {
          this.orb(x, propY, 'bonus');
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffed9c';
          ctx.font = '800 6px system-ui';
          ctx.fillText('500',x,propY + 2);
        } else if (pickup.kind === 'ruby') this.sprite('ruby', pickup.x, propY - pickup.h / 2, pickup.w, pickup.h);
        else this.orb(x, propY, pickup.kind);
      }
      for (const box of game.blocks) {
        if ((box.remaining || box.bump) && this.visible(box.x, box.y, box.w, box.h)) this.block(box);
      }
      for (const mob of game.monsters) {
        const { currentX: x, currentY: y, w, h, kind } = mob;
        if (mob.defeated || !this.visible(x, y, w, h)) continue;
        if (kind === 'cannon') {
          const recoil = Math.max(0, mob.recoilUntil - game.time);
          const kick = Math.sin(Math.min(1, recoil / .18) * Math.PI / 2);
          this.sprite(kind, x - kick * 2.8 * mob.face, y, w, h, mob.face < 0);
          if (recoil > .12 && mob.flash) {
            ctx.save();
            ctx.globalAlpha = (recoil - .12) / .06;
            ctx.fillStyle = '#ffd388';
            ctx.beginPath();
            ctx.ellipse(mob.flash.x + mob.face * 3, mob.flash.y, 5, 2.5, -.28 * mob.face, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
          }
        } else if (kind === 'ghost') {
          ctx.globalAlpha = mob.opacity ?? .18;
          this.sprite(kind, x, y, w, h, mob.face < 0);
          ctx.globalAlpha = 1;
        } else if (kind === 'cactus' || kind === 'bomb') {
          const frame = mob.travel / (kind === 'cactus' ? 4.8 : 3.3);
          this.animation(kind, frame, x + w / 2, y + h * 1.044, h * 1.12, mob.face < 0);
        } else if (kind === 'bat' || kind === 'bee') {
          const frame = Math.floor(game.time * (kind === 'bat' ? 16 : 24) + mob.id) % 4;
          const size = w * 1.10;
          this.animation(kind, Math.min(frame, 4 - frame), x + w / 2, y + h / 2 + size / 2, size, kind === 'bee' && mob.face < 0);
        } else if (kind === 'crawler') {
          const stretch = Math.sin(mob.travel / 4) * .12;
          ctx.save();
          ctx.translate(x + w / 2, y + h);
          if (mob.face > 0) ctx.scale(-1, 1);
          ctx.drawImage(this.images.crawler, -w * (1 + stretch) / 2, -h * (1 - stretch), w * (1 + stretch), h * (1 - stretch));
          ctx.restore();
        } else if (kind === 'rock') {
          this.rolling('rock', x, y, w, h, (x - mob.x) * 2 / w);
        } else {
          this.hardware(x, y + h * .23, w, h * .55);
        }
      }
      for (const item of game.outcomes) {
        ctx.globalAlpha = Math.min(1, item.time * 6);
        this.coin(item.x, item.y, game.time * 17);
      }
      ctx.globalAlpha = 1;
      for (const shot of game.shots) this.orb(shot.x,shot.y,'shot');
      for (const shot of game.enemyShots) this.sprite('cannonball', shot.x - 4, shot.y - 4, 8, 8);
      for (const particle of game.particles) {
        ctx.globalAlpha = particle.life / particle.max;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x - 1, particle.y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    block({ x, y, w, h, remaining, bump }) {
      const ctx = this.ctx;
      const lift = bump ? Math.sin(bump / .18 * Math.PI) * 4 : 0;
      y -= lift;
      const active = remaining > 0;
      const face = ctx.createLinearGradient(x, y, x + w, y + h);
      face.addColorStop(0, active ? '#ffe19a' : '#765361');
      face.addColorStop(.47, active ? '#c64b32' : '#54394d');
      face.addColorStop(1, active ? '#692640' : '#302239');
      ctx.beginPath();
      ctx.roundRect(x, y, w - .4, h - .4, 2.4);
      ctx.fillStyle = face;
      ctx.fill();
      ctx.strokeStyle = active ? '#fcc474' : '#8a687e';
      ctx.lineWidth = .66;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x + 1.35, y + 1.35, w - 2.95, h - 2.95, 1.4);
      ctx.strokeStyle = active ? '#652e3480' : '#1b1424a0';
      ctx.lineWidth = .45;
      ctx.stroke();
      for (const [dx, dy] of [[2.2, 2.2], [w - 2.7, 2.2], [2.2, h - 2.7], [w - 2.7, h - 2.7]]) {
        ctx.fillStyle = active ? '#ffd991' : '#927484';
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, .62, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (active) {
        ctx.fillStyle = '#fff0ab';
        ctx.font = '900 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('?', x + w/2, y + h*.74);
      }
    }

    hint(game) {
      const p = game.player;
      if (p.hanging || p.riding?.type === 12) {
        this.actionHint(p.x, p.y - 42, '↓ Drop');
        return;
      }
      if (game.level.number >= 98) return;
      for (const gate of game.level.gates) {
        if (!gate.hidden || gate.entry || Math.abs(p.x - (gate.x + gate.w/2)) > 29 || Math.abs(p.y - (gate.y + gate.h)) > 27) continue;
        this.actionHint(gate.x + gate.w / 2, Math.min(p.y - 39, gate.y - 8), '↓ Enter');
        return;
      }
    }

    actionHint(x, y, label) {
      const { ctx } = this;
      ctx.fillStyle = '#20152bed';
      ctx.beginPath();
      ctx.roundRect(x - 25, y - 10, 50, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#f9df9e';
      ctx.textAlign = 'center';
      ctx.font = '700 7px system-ui';
      ctx.fillText(label, x, y);
    }

    visible(x, y, w, h) {
      return x + w + 7 > this.camera.x && x - 7 < this.camera.x + this.width &&
        y + h + 7 > this.camera.y && y - 7 < this.camera.y + this.height;
    }

    coin(x, y, angle) {
      const { ctx } = this;
      const face = Math.abs(Math.cos(angle));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(.24 + face * .76, 1);
      const rim = ctx.createLinearGradient(-4, -7, 4, 7);
      rim.addColorStop(0, '#fff9cf');
      rim.addColorStop(.25, '#e39a38');
      rim.addColorStop(.56, '#fdd776');
      rim.addColorStop(1, '#82431f');
      ctx.beginPath();
      ctx.ellipse(1.05, .45, 5.7, 7.35, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#974c26';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.65, 7.35, 0, 0, 2 * Math.PI);
      ctx.fillStyle = rim;
      ctx.fill();
      ctx.strokeStyle = '#fff0a1';
      ctx.lineWidth = .33;
      ctx.stroke();
      if (face > .24) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.1, 5.7, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = '#a65d25';
        ctx.lineWidth = .58;
        ctx.stroke();
        ctx.fillStyle = '#a05425';
        ctx.beginPath();
        ctx.moveTo(.2,-3.7);
        ctx.lineTo(2,0);
        ctx.lineTo(.2,3.9);
        ctx.lineTo(-1.6,0);
        ctx.closePath();
        ctx.fill();
        ctx.translate(-.24,-.28);
        ctx.fillStyle = '#fff0a1';
        ctx.fill();
      }
      ctx.restore();
    }

    orb(x, y, kind) {
      const ctx = this.ctx;
      const size = kind === 'shot' ? 4.4 : 8.3;
      const heal = kind === 'health' || kind === 'hazard';
      const gold = kind === 'bonus' || kind === 'star';
      const shine = ctx.createRadialGradient(x - size * .28, y - size * .35, .1, x, y, size);
      shine.addColorStop(0, '#fff5e7');
      shine.addColorStop(.18, heal ? '#ffc2ca' : gold ? '#ffe1a1' : '#d0f3ff');
      shine.addColorStop(.53, heal ? '#fb6474' : gold ? '#b78741' : '#638cee');
      shine.addColorStop(1, heal ? '#8f204d' : gold ? '#503020' : '#233163');
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'shot') return;
      ctx.strokeStyle = heal ? '#ff9caa' : gold ? '#ffe7a2' : '#91caff';
      ctx.lineWidth = .85;
      ctx.stroke();
      if (kind === 'health') {
        ctx.fillStyle = '#fff1df';
        ctx.fillRect(x - 3.7, y - 1.1, 7.4, 2.2);
        ctx.fillRect(x - 1.1, y - 3.7, 2.2, 7.4);
      }
    }

    hero(game) {
      const { ctx } = this;
      const p = game.player;
      if (game.level.flight) {
        this.aircraft(p, game.time);
        return;
      }
      if (p.hanging) {
        const body = this.images['charly-jump'];
        const h = 36;
        const w = h * body.width / body.height;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.face, 1);
        const grip = p.hanging.currentY - p.y + 2;
        ctx.beginPath();
        ctx.moveTo(4.6, -19);
        ctx.quadraticCurveTo(15, -25, 9, grip + 2);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#594043';
        ctx.lineWidth = 6.3;
        ctx.stroke();
        ctx.strokeStyle = '#ddbf9d';
        ctx.lineWidth = 4.4;
        ctx.stroke();
        ctx.drawImage(body, -w / 2, -h + 2, w, h);
        const glove = ctx.createRadialGradient(7, grip - 1, .4, 9, grip, 4.3);
        glove.addColorStop(0, '#ffb27d');
        glove.addColorStop(.32, '#ea5142');
        glove.addColorStop(1, '#6f181e');
        ctx.fillStyle = glove;
        ctx.beginPath();
        ctx.ellipse(9, grip, 4, 3.6, -.26, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        return;
      }
      const jumping = !p.grounded;
      const running = !p.duck && !jumping && p.walking;
      if (p.grounded) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + .25, p.duck ? 16 : 13, 2.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#140b1978';
        ctx.fill();
      }
      ctx.save();
      if (p.invulnerable && (game.time * 13 | 0) % 2) ctx.globalAlpha = .42;
      if (running) {
        const frame = Math.floor(p.travel / 7.7) % 6;
        const lift = frame === 2 || frame === 5 ? 1.65 : 0;
        this.animation('hero', frame, p.x, p.y + 1.9 - lift, 43, p.face < 0);
      } else {
        const body = this.images['charly-' + (p.duck ? 'duck' : jumping ? 'jump' : 'idle')];
        const h = p.duck ? 27 : jumping ? 37 : 39;
        const w = h * body.width / body.height;
        ctx.translate(p.x, p.y);
        ctx.scale(p.face, 1);
        ctx.drawImage(body, -w / 2, -h, w, h);
      }
      ctx.restore();
    }

    light(game) {
      const ctx = this.ctx;
      if (!this.backdrop && this.lightMask?.ratio !== this.width / this.height) {
        const mask = document.createElement('canvas');
        mask.height = 96;
        mask.width = Math.ceil(96 * this.width / this.height);
        const layer = mask.getContext('2d');
        const { width, height } = mask;
        const vignette = layer.createRadialGradient(width / 2, height * .42, height * .3,
          width / 2, height * .48, width * .65);
        vignette.addColorStop(0, '#10051400');
        vignette.addColorStop(1, '#120619bc');
        layer.fillStyle = vignette;
        layer.fillRect(0,0,width,height);
        this.lightMask = { mask, ratio: this.width / this.height };
      }
      if (!this.backdrop) ctx.drawImage(this.lightMask.mask, 0, 0, this.width, this.height);
      if (this.reducedMotion) return;
      for (let i = 0; i < 21; i++) {
        const x = ((i * 73.48 + game.time * (3 + i % 4) - this.camera.x * .19) % this.width + this.width) % this.width;
        const y = 31 + i * 53.5 % 130 + Math.sin(game.time * .7 + i) * 6;
        ctx.globalAlpha = .2 + .17 * Math.sin(game.time * 1.7 + i);
        ctx.fillStyle = i % 3 ? '#ffc786' : '#f6948a';
        ctx.fillRect(x, y, i % 5 ? .65 : 1.1, i % 5 ? .65 : 1.1);
      }
      ctx.globalAlpha = 1;
    }

  }

  Charly.Renderer = Renderer;
})();
