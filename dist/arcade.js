(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const screen = byId('screen');
  const cabinet = byId('cabinet');
  const canvas = byId('game-canvas');
  const overlay = byId('overlay');
  const overlayAction = byId('overlay-action');
  const overlayTitle = byId('overlay-title');
  const overlayDetail = byId('overlay-detail');
  const backToCover = byId('back-to-cover');
  const start = byId('start');
  const pause = byId('pause-game');
  const restart = byId('restart');
  const soundButton = byId('toggle-sound');
  const fullscreen = byId('fullscreen');
  const controls = byId('controls');
  const levels = byId('levels');
  const stageNotice = byId('stage-notice');
  const labels = { 1: "It's Easy", 2: 'More Easy', 13: 'Time to Play', 14: 'Daily Plane', 16: 'Jump Up!', 17: 'Forrest', 19: 'Wizzard', 21: 'Climb Down!', 24: 'CD-ROM', 25: 'Look Right!' };
  const touch = byId('touch-controls');
  const hud = Object.fromEntries(['health', 'lives', 'coins', 'ammo', 'score'].map(id => [id, byId(id)]));
  const renderer = new Charly.Renderer(canvas);
  const input = new Map();
  const keyMap = new Map([
    ['ArrowLeft', 'left'], ['KeyA', 'left'], ['ArrowRight', 'right'], ['KeyD', 'right'],
    ['ArrowUp', 'jump'], ['KeyW', 'jump'], ['ArrowDown', 'duck'], ['KeyS', 'duck'],
    ['Space', 'throw'], ['KeyX', 'throw'],
  ]);

  let mode = 'cover';
  let loadAttempt = 0;
  let artReady = false;
  let pauseForMenu = false;
  let noticeTimer = 0;
  let progress = readProgress();
  let muted = readPreference('muted') === 'true';
  let raf = 0;
  let lastFrame = 0;
  let accumulator = 0;
  let hudHash = '';
  let resumeRun = false;
  const sound = new ArcadeSound();
  const game = new Charly.Game(onGameEvent);

  function readPreference(key) {
    try { return localStorage.getItem('charly-' + key); }
    catch { return null; }
  }

  function savePreference(key, value) {
    try { localStorage.setItem('charly-' + key, value); }
    catch { /* The game also runs with storage disabled. */ }
  }

  function readProgress() {
    try {
      const saved = JSON.parse(readPreference('progress-v2')) || {};
      return {
        resume: CharlyStages[saved.resume] && saved.resume < 98 ? Number(saved.resume) : 1,
        cleared: Array.isArray(saved.cleared) ? saved.cleared.filter(n => CharlyStages[n] && n < 98) : [],
        heard: Array.isArray(saved.heard) ? saved.heard.filter(n => n >= 98 && CharlyStages[n]) : [],
      };
    } catch { return { resume: 1, cleared: [], heard: [] }; }
  }

  function stageLabel(number) {
    const raw = CharlyStages[number].name;
    return labels[number] || raw[0] + raw.slice(1).toLowerCase();
  }

  function stageNumber(number) {
    return number >= 98 ? 'BONUS MAP' : number === 70 ? 'FINALE' : 'LEVEL ' + String(number).padStart(2, '0');
  }

  function refreshStage(number, onCover = false) {
    byId('level-number').textContent = stageNumber(number);
    byId('level-name').textContent = number >= 70 ? (number === 70 ? 'THE CIRCUS' : 'SECRET ROUTE') : stageLabel(number).toUpperCase();
    byId('overlay-kicker').textContent = stageNumber(number);
    byId('stage-heading').textContent = onCover ? 'The 25-level campaign' : number >= 98 ? 'Hidden bonus map' : stageLabel(number);
    const flight = Charly.stage(number).flight && !onCover;
    byId('stage-objective').textContent = onCover ? 'Find the exit and look for hidden bonus routes.' :
      flight ? 'Steer the plane with the arrows and use Throw to fire.' :
      number >= 98 ? 'Collect the bonuses and find a door back.' : 'Jump into question boxes from below and follow the route to the exit.';
    canvas.setAttribute('aria-label', stageNumber(number) + ' gameplay');
    touch.querySelector('[data-control=jump]').textContent = flight ? 'UP' : 'JUMP';
    touch.querySelector('[data-control=jump]').setAttribute('aria-label', flight ? 'Fly up' : 'Jump');
    touch.querySelector('[data-control=duck]').setAttribute('aria-label', flight ? 'Fly down' : 'Duck, enter, or drop');
    touch.querySelector('[data-control=throw]').textContent = flight ? 'FIRE' : 'THROW';
    touch.querySelector('[data-control=throw]').setAttribute('aria-label', flight ? 'Fire' : 'Throw a marble');
    byId('start-label').textContent = resumeRun ? 'Resume ' + stageLabel(game.level.number) : progress.resume === 1 ? 'Play Level 1' : progress.resume === 70 ? 'Continue to the finale' : 'Continue Level ' + progress.resume;
  }

  function saveProgress() {
    savePreference('progress-v2', JSON.stringify(progress));
  }

  function showNotice(text) {
    stageNotice.textContent = text;
    stageNotice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { stageNotice.hidden = true; }, 3000);
  }

  function setMode(next) {
    mode = next;
    screen.dataset.state = next;
    pause.hidden = !['playing', 'paused'].includes(next);
    restart.hidden = desktop ? next !== 'cover' || !resumeRun : ['cover', 'loading'].includes(next);
    touch.hidden = next !== 'playing';
    overlay.hidden = next === 'cover' || next === 'playing';
    pause.setAttribute('aria-label', next === 'paused' ? 'Resume' : 'Pause');
    pause.title = pause.getAttribute('aria-label');
    pause.querySelector('use').setAttribute('href', next === 'paused' ? '#play' : '#pause');
    if (next === 'playing') {
      renderer.resize();
      lastFrame = 0;
      if (!raf) raf = requestAnimationFrame(tick);
      canvas.focus({ preventScroll: true });
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      accumulator = 0;
      releaseAll();
    }
    sound.setActive(next === 'playing' && !muted);
  }

  function showOverlay(title, detail, label, action) {
    overlayTitle.textContent = title;
    overlayDetail.textContent = detail;
    overlayAction.hidden = !action;
    overlayAction.textContent = label || '';
    overlayAction.onclick = action || null;
    if (action) overlayAction.focus({ preventScroll: true });
  }

  async function newGame(number = progress.resume, continueRun = false) {
    const attempt = ++loadAttempt;
    resumeRun = false;
    sound.unlock();
    game.reset(number, continueRun);
    if (number < 98) { progress.resume = number; saveProgress(); }
    stageNotice.hidden = true;
    refreshStage(number);
    renderer.resetCamera();
    refreshHud();
    if (!artReady) {
      setMode('loading');
      showOverlay('Loading', 'Preparing the jungle…');
      try {
        await renderer.load();
        artReady = true;
      } catch (error) {
        if (attempt === loadAttempt) showOverlay('Load failed', error.message, 'Try again', () => newGame(number, continueRun));
        return;
      }
    }
    if (attempt !== loadAttempt) return;
    setMode('playing');
    renderer.frame(game, 0);
  }

  function returnToCover(keepRun = false) {
    ++loadAttempt;
    resumeRun = keepRun;
    setMode('cover');
    refreshStage(progress.resume, true);
    start.focus({ preventScroll: true });
  }

  function togglePause() {
    if (mode === 'playing') {
      setMode('paused');
      showOverlay('Paused', 'Your run will resume here.', 'Resume', togglePause);
    } else if (mode === 'paused') {
      sound.unlock();
      setMode('playing');
    }
  }

  function tick(now) {
    raf = 0;
    if (mode !== 'playing') return;
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .065) : 1 / 60;
    lastFrame = now;
    accumulator += dt;
    while (accumulator >= Charly.STEP && mode === 'playing') {
      game.step(Charly.STEP);
      accumulator -= Charly.STEP;
    }
    renderer.frame(game, dt);
    refreshHud();
    if (mode === 'playing') raf = requestAnimationFrame(tick);
  }

  function onGameEvent(name, detail) {
    sound.play(name);
    if (name === 'secret' || name === 'return') {
      releaseAll();
      refreshStage(game.level.number);
      if (name === 'secret') {
        if (!progress.heard.includes(game.level.number)) progress.heard.push(game.level.number);
        saveProgress();
        showNotice('Secret map discovered');
      } else showNotice('Back to Level ' + game.level.number);
      return;
    }
    if (name !== 'complete' && name !== 'gameover') return;
    setMode(name === 'complete' ? 'complete' : 'gameover');
    const best = Math.max(Number(readPreference('best-campaign')) || 0, game.score);
    savePreference('best-campaign', best);
    const summary = game.score.toLocaleString() + ' points · ' + game.coins + ' coins · Best ' + best.toLocaleString();
    if (name === 'gameover') {
      showOverlay('Game over', summary, 'Retry level', () => newGame(game.level.number));
      return;
    }
    if (!progress.cleared.includes(detail.number)) progress.cleared.push(detail.number);
    progress.resume = detail.next;
    saveProgress();
    if (detail.number === 70) showOverlay('Campaign complete', summary, 'Play again', () => newGame(1));
    else showOverlay('Level complete', summary, detail.next === 70 ? 'Play the finale' : 'Next level', () => newGame(detail.next, true));
  }

  function refreshHud() {
    const hash = [game.level.number, game.health, game.lives, game.coins, game.ammo, game.score].join(',');
    if (hudHash === hash) return;
    hudHash = hash;
    hud.health.setAttribute('aria-label', game.health + ' of 5 health');
    hud.health.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
      const heart = document.createElement('span');
      heart.textContent = '♥';
      heart.classList.toggle('empty', index >= game.health);
      heart.setAttribute('aria-hidden', 'true');
      return heart;
    }));
    for (const key of ['lives', 'coins', 'ammo', 'score']) hud[key].textContent = game.level.flight && key === 'ammo' ? '∞' : String(game[key]).padStart(key === 'score' ? 5 : 2, '0');
  }

  function changeInput(id, action, down) {
    if (down) {
      if (mode !== 'playing' || input.has(id)) return;
      if (![...input.values()].includes(action)) game.input(action, true);
      input.set(id, action);
    } else {
      const prior = input.get(id);
      if (!prior) return;
      input.delete(id);
      if (![...input.values()].includes(prior)) game.input(prior, false);
    }
  }

  function releaseAll() {
    input.clear();
    game.release();
    touch.querySelectorAll('.held').forEach(button => button.classList.remove('held'));
  }

  function updateSound() {
    const label = muted ? 'Unmute' : 'Mute';
    soundButton.title = label;
    soundButton.setAttribute('aria-label', label);
    soundButton.setAttribute('aria-pressed', String(muted));
    soundButton.querySelector('use').setAttribute('href', muted ? '#muted' : '#sound');
    const text = soundButton.querySelector('.button-label');
    if (text) text.textContent = label;
    sound.mute(muted);
    sound.setActive(mode === 'playing' && !muted);
  }

  const desktop = window.charlyDesktop;
  if (desktop) {
    document.body.classList.add('desktop');
    const menu = byId('title-tools');
    menu.hidden = false;
    for (const [button, label] of [[soundButton, 'Mute'], [fullscreen, 'Fullscreen'], [restart, 'Restart']]) {
      button.className = 'top-button';
      const text = document.createElement('span');
      text.className = 'button-label';
      text.textContent = label;
      button.append(text);
    }
    menu.append(byId('show-levels'), byId('show-controls'), soundButton, fullscreen, restart, byId('quit-game'));
    byId('escape-help').textContent = 'Return to title / quit from title';
    byId('quit-game').hidden = false;
    byId('quit-game').addEventListener('click', desktop.quit);
    window.addEventListener('keydown', event => {
      if (event.key === 'F11' && !event.repeat) {
        event.preventDefault();
        toggleFullscreen();
      }
    });
    desktop.onFullscreen(active => {
      document.body.classList.toggle('desktop-fullscreen', active);
      updateFullscreen();
    });
  }

  function updateFullscreen() {
    const expanded = document.body.classList.contains('desktop-fullscreen') || !!document.fullscreenElement || cabinet.classList.contains('expanded');
    fullscreen.title = expanded ? 'Exit fullscreen' : 'Fullscreen';
    fullscreen.setAttribute('aria-label', fullscreen.title);
    fullscreen.setAttribute('aria-pressed', String(expanded));
    const text = fullscreen.querySelector('.button-label');
    if (text) text.textContent = expanded ? 'Windowed mode' : 'Fullscreen';
  }

  async function toggleFullscreen() {
    if (desktop) {
      desktop.fullscreen();
      if (mode === 'playing') canvas.focus({ preventScroll: true });
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (cabinet.classList.contains('expanded')) {
      cabinet.classList.remove('expanded');
      document.body.classList.remove('expanded');
    } else {
      try {
        if (!cabinet.requestFullscreen) throw new Error('Fullscreen API unavailable');
        await cabinet.requestFullscreen();
      } catch {
        cabinet.classList.add('expanded');
        document.body.classList.add('expanded');
      }
    }
    updateFullscreen();
    if (mode === 'playing') canvas.focus({ preventScroll: true });
  }

  function startOrResume() {
    if (!resumeRun) {
      newGame();
      return;
    }
    resumeRun = false;
    sound.unlock();
    refreshStage(game.level.number);
    setMode('playing');
    renderer.frame(game, 0);
  }

  start.addEventListener('click', startOrResume);
  restart.addEventListener('click', () => newGame(game.branch?.level.number ?? game.level.number));
  pause.addEventListener('click', togglePause);
  backToCover.addEventListener('click', () => returnToCover());
  soundButton.addEventListener('click', () => {
    muted = !muted;
    if (!muted) sound.unlock();
    savePreference('muted', muted);
    updateSound();
    if (mode === 'playing') canvas.focus({ preventScroll: true });
  });
  fullscreen.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreen);
  function openMenu(dialog) {
    pauseForMenu = mode === 'playing';
    if (pauseForMenu) togglePause();
    dialog.showModal();
  }

  for (const dialog of [controls, levels]) {
    dialog.addEventListener('close', () => {
      if (pauseForMenu && mode === 'paused') togglePause();
      pauseForMenu = false;
    });
  }
  byId('show-controls').addEventListener('click', () => openMenu(controls));
  byId('show-levels').addEventListener('click', () => {
    const grid = byId('level-grid');
    const cleared = progress.cleared.filter(number => number <= 25).length;
    const bonuses = progress.heard.length ? ' · ' + progress.heard.length + ' of 2 bonus maps found' : '';
    byId('level-progress').textContent = cleared + ' of 25 cleared' + bonuses;
    const numbers = Array.from({ length: 25 }, (_, index) => index + 1);
    if (progress.cleared.includes(25)) numbers.push(70);
    grid.replaceChildren(...numbers.map(number => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-choice';
      const index = document.createElement('strong');
      index.textContent = number === 70 ? 'FINALE' : String(number).padStart(2, '0');
      const name = document.createElement('span');
      name.textContent = number === 70 ? 'The Circus' : stageLabel(number);
      button.append(index, name);
      if (progress.cleared.includes(number)) {
        button.classList.add('cleared');
        button.setAttribute('aria-label', stageNumber(number) + ' ' + name.textContent + ' cleared');
      }
      button.addEventListener('click', () => {
        pauseForMenu = false;
        levels.close();
        newGame(number);
      });
      return button;
    }));
    openMenu(levels);
  });

  document.addEventListener('keydown', event => {
    if (controls.open || levels.open || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === 'Escape' && desktop) {
      if (!event.repeat) {
        if (mode === 'cover') desktop.quit();
        else returnToCover(mode === 'playing' || mode === 'paused');
      }
      event.preventDefault();
      return;
    }
    if (event.code === 'Escape' && ['playing', 'paused'].includes(mode)) {
      if (!event.repeat) togglePause();
      event.preventDefault();
      return;
    }
    if (event.code === 'Enter' && mode === 'cover' && !event.target.closest('button, a')) {
      event.preventDefault();
      startOrResume();
      return;
    }
    const action = keyMap.get(event.code);
    if (action && mode === 'playing' && !event.target.closest('button, a')) {
      event.preventDefault();
      changeInput(event.code, action, true);
    }
  });
  document.addEventListener('keyup', event => changeInput(event.code, keyMap.get(event.code), false));
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') togglePause();
  });

  for (const button of touch.querySelectorAll('button')) {
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add('held');
      changeInput('touch-' + event.pointerId, button.dataset.control, true);
    });
    function pointerEnd(event) {
      changeInput('touch-' + event.pointerId, button.dataset.control, false);
      button.classList.remove('held');
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, pointerEnd);
  }

  new ResizeObserver(() => {
    if (artReady && mode !== 'cover' && mode !== 'loading') {
      renderer.resize();
      renderer.frame(game, 0);
    }
  }).observe(canvas);

  updateSound();
  updateFullscreen();
  refreshStage(progress.resume, true);

  function ArcadeSound() {
    let context;
    let master;
    let loop;
    let nextNote = 0;
    let beat = 0;
    let enabled = true;
    const bass = [45, 45, 48, 45, 43, 43, 50, 43, 41, 41, 48, 41, 43, 43, 50, 43];
    const lead = [69, 0, 72, 74, 76, 0, 74, 72, 67, 0, 69, 72, 74, 0, 72, 0, 65, 0, 67, 69, 72, 0, 69, 67, 67, 0, 69, 74, 72, 0, 69, 0];
    const effects = {
      jump: [69, 76], spring: [55, 67, 81], coin: [81, 86], ammo: [62, 67, 74],
      health: [66, 71, 79], checkpoint: [64, 71, 76], secret: [57, 64, 69, 76, 81], return: [65, 72, 77], box: [67, 74], throw: [64, 54],
      cannon: [38, 30], hit: [58, 52], hurt: [51, 43], respawn: [40, 59], complete: [66, 69, 73, 76, 81],
      gameover: [61, 57, 54, 49],
    };
    function note(midi, at, length, volume, type = 'triangle') {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(volume, at + .013);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + length);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(at);
      oscillator.stop(at + length + .005);
    }
    this.unlock = () => {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context = new Audio();
        master = context.createGain();
        master.gain.value = enabled ? .47 : 0;
        master.connect(context.destination);
      }
      context.resume().catch(() => {});
    };
    this.mute = muted => {
      enabled = !muted;
      if (master) master.gain.setTargetAtTime(enabled ? .47 : 0, context.currentTime, .012);
    };
    this.setActive = active => {
      clearInterval(loop);
      if (!active || !context) return;
      nextNote = context.currentTime + .02;
      loop = setInterval(() => {
        if (context.state !== 'running') return;
        if (nextNote < context.currentTime - .1) nextNote = context.currentTime;
        while (nextNote < context.currentTime + .16) {
          if (beat % 2 === 0) note(bass[(beat / 2) % bass.length], nextNote, .26, .074, 'sine');
          const voice = lead[beat % lead.length];
          if (voice) note(voice, nextNote, .21, .035);
          nextNote += .147;
          beat++;
        }
      }, 83);
    };
    this.play = name => {
      if (!enabled || !context || !effects[name]) return;
      const now = context.currentTime;
      effects[name].forEach((pitch, i) => note(pitch, now + i * .055, .14, .115));
    };
  }
})();
