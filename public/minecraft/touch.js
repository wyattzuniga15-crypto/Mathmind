'use strict';
// ---------------------------------------------------------------- touch controls (Bedrock-style)
// Left zone: floating joystick. Elsewhere: drag to look, tap to place/attack/
// interact, hold to mine (or eat / draw the bow). Buttons: jump, sneak,
// inventory, pause.

const TouchUI = {
  joyTouch: null, camTouch: null, holdActive: false,

  init(game) {
    if (!game.touchMode) return;
    document.body.classList.add('touch');
    const canvas = game.canvas;
    const base = document.getElementById('joybase');
    const knob = document.getElementById('joyknob');
    const R = 55;

    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); Sfx.ensure(); down(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); if (up) up(); }, { passive: false });
      el.addEventListener('contextmenu', e => e.preventDefault());
    };
    btn('btnjump', () => Input.keys['Space'] = true, () => Input.keys['Space'] = false);
    btn('btnsneak', () => {
      Input.keys['ShiftLeft'] = !Input.keys['ShiftLeft'];
      document.getElementById('btnsneak').classList.toggle('on', !!Input.keys['ShiftLeft']);
    });
    btn('btntouchinv', () => {
      if (Input.uiOpen) UI.close();
      else if (game.state === 'playing') UI.open('inv');
    });
    btn('btntouchpause', () => { if (game.state === 'playing') game.pause(); });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      Sfx.ensure();
      if (game.state !== 'playing' || Input.uiOpen) return;
      for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY;
        if (!this.joyTouch && x < innerWidth * 0.42 && y > innerHeight * 0.3) {
          this.joyTouch = { id: t.identifier, ax: x, ay: y };
          base.style.display = knob.style.display = 'block';
          base.style.left = (x - 60) + 'px'; base.style.top = (y - 60) + 'px';
          knob.style.left = (x - 26) + 'px'; knob.style.top = (y - 26) + 'px';
        } else if (!this.camTouch) {
          this.camTouch = { id: t.identifier, x, y, t0: performance.now(), moved: 0 };
          this.camTouch.hold = setTimeout(() => this.startHold(game), 260);
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joyTouch && t.identifier === this.joyTouch.id) {
          const dx = t.clientX - this.joyTouch.ax, dy = t.clientY - this.joyTouch.ay;
          const m = Math.hypot(dx, dy) || 1;
          const cl = Math.min(m, R);
          const nx = dx / m, ny = dy / m;
          knob.style.left = (this.joyTouch.ax + nx * cl - 26) + 'px';
          knob.style.top = (this.joyTouch.ay + ny * cl - 26) + 'px';
          Input.analog = { fw: -ny * (cl / R), st: nx * (cl / R), sprint: m > R * 1.2 };
        } else if (this.camTouch && t.identifier === this.camTouch.id) {
          const c = this.camTouch;
          const dx = t.clientX - c.x, dy = t.clientY - c.y;
          c.moved += Math.abs(dx) + Math.abs(dy);
          c.x = t.clientX; c.y = t.clientY;
          const p = game.player, sens = 0.0075 * game.sens;
          p.yaw -= dx * sens;
          p.pitch = clamp(p.pitch - dy * sens, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
          if (this.holdActive) Input.aimRay = game.screenRay(c.x, c.y);
        }
      }
    }, { passive: false });

    const endTouch = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joyTouch && t.identifier === this.joyTouch.id) {
          this.joyTouch = null; Input.analog = null;
          base.style.display = knob.style.display = 'none';
        } else if (this.camTouch && t.identifier === this.camTouch.id) {
          const c = this.camTouch;
          clearTimeout(c.hold);
          if (this.holdActive) this.stopHold();
          else if (performance.now() - c.t0 < 280 && c.moved < 16) this.tap(game, c.x, c.y);
          this.camTouch = null;
        }
      }
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });
  },

  startHold(game) {
    const c = this.camTouch;
    if (!c || c.moved > 18 || game.state !== 'playing' || Input.uiOpen) return;
    this.holdActive = true;
    Input.aimRay = game.screenRay(c.x, c.y);
    const held = game.inv.held();
    const d = held ? itemDef(held.id) : null;
    if (d && ((d.food && game.player.hunger < 20) || held.id === I.bow)) Input.mouseRight = true;
    else Input.mouseLeft = true;
  },
  stopHold() {
    this.holdActive = false;
    Input.mouseLeft = false; Input.mouseRight = false;
    Input.aimTTL = 0.25;   // keep the aim a moment so a bow release still fires
  },
  tap(game, x, y) {
    const ray = game.screenRay(x, y);
    Input.aimRay = ray; Input.aimTTL = 0.3;
    if (game.tryAttack(ray)) return;
    Input.rightClicks.push(1);   // place / use / interact at the tapped spot
  },
};
