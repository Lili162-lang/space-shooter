import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
  effect,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type Vec = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx?: number;
  vy?: number;
  alive?: boolean;
  angle?: number; // rotación en radianes
  spin?: number;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  frame: number; // índice de frame
  t: number; // tiempo acumulado (s)
};

@Component({
  selector: 'app-play',
  standalone: true,
  templateUrl: './play.page.html',
  styleUrl: './play.page.css',
})
export class PlayPage implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // --- Touch state ---
  private pointerDown = false;
  private pointerId: number | null = null;
  private lastShotMs = 0;
  private autoFire = true;
  private readonly fireEveryMs = 200;

  private updatePlayerFromPointer = (e: PointerEvent) => {
    const c = this.canvasRef.nativeElement;
    const r = c.getBoundingClientRect();
    const xCanvas = ((e.clientX - r.left) / r.width) * 480; // coord canvas
    this.player.x = Math.max(
      0,
      Math.min(480 - this.player.w, xCanvas - this.player.w / 2)
    );
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.gameOver()) return;
    e.preventDefault();
    const c = this.canvasRef.nativeElement;
    c.setPointerCapture(e.pointerId);
    this.pointerDown = true;
    this.pointerId = e.pointerId;
    this.updatePlayerFromPointer(e); // mueve al toque
    this.shoot(); // tap dispara
    this.lastShotMs = e.timeStamp;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.updatePlayerFromPointer(e); // drag para mover
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.pointerDown = false;
    this.pointerId = null;
  };

  // Expose Math to template
  Math = Math;

  // HUD
  errorMsg = signal<string | null>(null);
  gameOver = signal(false);
  durationSec = signal(0);
  paused = signal(false);
  maxCombo = signal(0);
  life = signal(100);
  score = signal(0);
  combo = signal(0);

  private ctx!: CanvasRenderingContext2D;
  private req = 0;
  private last = 0;
  private keys: Record<string, boolean> = {};
  private player: Vec = { x: 220, y: 630, w: 100, h: 100 };
  private bullets: Vec[] = [];
  private enemies: Vec[] = [];
  private spawnMs = 900; // se ajusta por dificultad
  private lastSpawn = 0;

  private readonly router = inject(Router);
  private readonly scores = inject(ScoreHttpService);
  private readonly destroyRef = inject(DestroyRef);

  private explosions: Explosion[] = [];
  private explosionFrames: HTMLImageElement[] = [];
  private readonly explosionFPS = 16; // velocidad de animación

  private sfx = {
    explosion: new Audio('assets/sounds/sound-explosion.wav'),
    hit: new Audio('assets/sounds/crash.wav'),
  };
  private audioReady = false;

  ngAfterViewInit(): void {
    const c = this.canvasRef.nativeElement;
    c.width = 480;
    c.height = 720;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    const canvasEl = this.canvasRef.nativeElement;
    canvasEl.addEventListener('pointerdown', this.onPointerDown, {
      passive: false,
    });
    canvasEl.addEventListener('pointermove', this.onPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', this.onPointerUp, { passive: false });

    // bloquea menú contextual por long-press
    canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // dificultad desde navigation state
    const st = history.state as { difficulty?: 'easy' | 'normal' | 'hard' };
    this.setDifficulty(st?.difficulty ?? 'easy');

    // input
    window.addEventListener('keydown', this.onKey, false);
    window.addEventListener('keyup', this.onKey, false);

    this.loop(0);

    //integración img
    this.ctx.imageSmoothingEnabled = false; // pixel-art más nítido
    this.preloadSprites().then(() => (this.ready = true));

    // SFX
    this.sfx.explosion.preload = 'auto';
    this.sfx.explosion.volume = 0.6;
    this.sfx.hit.preload = 'auto';
this.sfx.hit.volume = 0.7;


    // Desbloquear audio tras primera interacción del usuario
    const unlock = () => {
      this.audioReady = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.req);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    const canvasEl = this.canvasRef.nativeElement;
    canvasEl.removeEventListener('pointerdown', this.onPointerDown);
    canvasEl.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  // play.page.ts
  private img = {
    ship: new Image(),
    asteroid: new Image(),
    bg: new Image(),
    shoot: new Image(),
  };

  private ready = false;

  private setDifficulty(d: 'easy' | 'normal' | 'hard') {
    if (d === 'easy') this.spawnMs = 900;
    else if (d === 'normal') this.spawnMs = 650;
    else this.spawnMs = 450;
  }
  private playExplosion() {
    if (!this.audioReady) return;
    const a = this.sfx.explosion.cloneNode(true) as HTMLAudioElement; // permite solaparse
    a.volume = this.sfx.explosion.volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  private playHit() {
    if (!this.audioReady) return;
    const a = this.sfx.hit.cloneNode(true) as HTMLAudioElement;
    a.volume = this.sfx.hit.volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  }
  

  togglePause() {
    if (this.gameOver()) return;
    this.paused.update((v) => !v);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.type === 'keydown') {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        this.togglePause();
        return;
      }
      this.keys[e.key] = true;
      if (e.key === ' ') this.shoot();
    } else {
      this.keys[e.key] = false;
    }
  };
  private shoot() {
    if (this.paused() || this.gameOver()) return;
    const scale = 0.5; // reduce a la mitad el sprite
    const w = this.img.shoot.width * scale || 6;
    const h = this.img.shoot.height * scale || 12;

    this.bullets.push({
      x: this.player.x + this.player.w / 2 - w / 2,
      y: this.player.y - h,
      w,
      h,
      vy: -10,
      alive: true,
    });
  }

  private spawnEnemy() {
    const x = Math.random() * (480 - 36);
    this.enemies.push({
      x,
      y: -36,
      w: 36,
      h: 36,
      vy: 2 + Math.random() * 1.5,
      alive: true,
      angle: Math.random() * Math.PI * 2, // arranca en ángulo random
      spin: (Math.random() - 0.5) * 0.1,
    });
  }

  private loop = (ts: number) => {
    this.req = requestAnimationFrame(this.loop);
    const dt = this.last ? (ts - this.last) / 1000 : 0;
    this.last = ts;

    if (this.paused() || this.gameOver()) {
      this.render();
      return;
    }

    // autofire mientras el dedo esté apoyado
    if (
      this.pointerDown &&
      this.autoFire &&
      ts - this.lastShotMs >= this.fireEveryMs
    ) {
      this.shoot();
      this.lastShotMs = ts;
    }

    // tiempo
    this.durationSec.update((t) => t + dt);

    // input
    const speed = 240 * dt;
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'])
      this.player.x -= speed;
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'])
      this.player.x += speed;
    this.player.x = Math.max(0, Math.min(480 - this.player.w, this.player.x));

    // spawn
    if (ts - this.lastSpawn > this.spawnMs) {
      this.spawnEnemy();
      this.lastSpawn = ts;
    }

    // update bullets
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.y += b.vy!;
      if (b.y < -20) b.alive = false;
    }

    // update enemies
    for (const en of this.enemies) {
      if (!en.alive) continue;
      en.y += en.vy!;
      if (en.spin) en.angle = (en.angle ?? 0) + en.spin;
      if (en.y > 760) {
        en.alive = false;
        this.combo.set(0);
        this.life.update((l) => Math.max(0, l - 10));
        this.playHit()
      }

    }

    // collisions bullets vs enemies
    for (const b of this.bullets)
      if (b.alive) {
        for (const en of this.enemies)
          if (en.alive) {
            if (this.aabb(b, en)) {
              b.alive = false;
              en.alive = false;
              this.playExplosion(); // sonido
              this.explosions.push({
                x: en.x,
                y: en.y,
                w: en.w,
                h: en.h,
                frame: 0,
                t: 0,
              }); // ya lo tienes
              this.combo.update((c) => c + 1);
              this.maxCombo.update((m) => Math.max(m, this.combo()));
              this.score.update((s) => s + 100 * this.combo());
              this.explosions.push({
                x: en.x,
                y: en.y,
                w: en.w,
                h: en.h,
                frame: 0,
                t: 0,
              });
            }
          }
      }

    const frameDt = 1 / this.explosionFPS;
    for (const ex of this.explosions) {
      ex.t += dt;
      while (ex.t >= frameDt) {
        ex.t -= frameDt;
        ex.frame++;
      }
    }

    // eliminar terminadas
    this.explosions = this.explosions.filter(
      (ex) => ex.frame < this.explosionFrames.length
    );
    // enemy vs player
    for (const en of this.enemies)
      if (en.alive && this.aabb(en, this.player)) {
        en.alive = false;
        this.combo.set(0);
        this.life.update((l) => Math.max(0, l - 25));
        this.playHit();
      }

    if (this.life() <= 0) this.gameOver.set(true);

    // compact arrays
    this.bullets = this.bullets.filter((b) => b.alive);
    this.enemies = this.enemies.filter((e) => e.alive);

    this.render();
  };

  private aabb(a: Vec, b: Vec): boolean {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  private render() {
    const ctx = this.ctx;
    // fondo
    if (this.ready && this.img.bg.width) {
      ctx.drawImage(this.img.bg, 0, 0, 480, 720);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 480, 720);
    }

    // jugador
    if (this.ready) {
      ctx.drawImage(
        this.img.ship,
        this.player.x,
        this.player.y,
        this.player.w,
        this.player.h
      );
    } else {
      ctx.fillStyle = '#4af';
      ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
    }

    // balas
    if (this.ready) {
      for (const b of this.bullets) {
        ctx.drawImage(this.img.shoot, b.x, b.y, b.w, b.h);
      }
    } else {
      ctx.fillStyle = '#fff';
      for (const b of this.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // enemigos
    if (this.ready) {
      for (const e of this.enemies) {
        const angle = e.angle ?? 0;
        this.ctx.save();
        this.ctx.translate(e.x + e.w / 2, e.y + e.h / 2); // centro del sprite
        this.ctx.rotate(angle);
        this.ctx.drawImage(this.img.asteroid, -e.w / 2, -e.h / 2, e.w, e.h);
        this.ctx.restore();
      }
    } else {
      this.ctx.fillStyle = '#f55';
      for (const e of this.enemies) this.ctx.fillRect(e.x, e.y, e.w, e.h);
    }

    // explosiones
    if (this.ready && this.explosionFrames.length) {
      for (const ex of this.explosions) {
        const img =
          this.explosionFrames[
            Math.min(ex.frame, this.explosionFrames.length - 1)
          ];
        // centra el frame sobre el enemigo original
        this.ctx.drawImage(img, ex.x, ex.y, ex.w, ex.h);
      }
    }

    // HUD
    ctx.fillStyle = '#0f0';
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${this.score()}`, 10, 20);
    ctx.fillText(`Life: ${this.life()}`, 10, 40);
    ctx.fillText(`Combo: ${this.combo()} (max ${this.maxCombo()})`, 10, 60);
    ctx.fillText(`Time: ${this.durationSec().toFixed(1)}s`, 10, 80);

    if (this.paused()) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 480, 720);
      ctx.fillStyle = '#fff';
      ctx.font = '28px monospace';
      // ctx.fillText('JUEGO EN PAUSA', 110, 360);
    }

    if (this.gameOver()) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, 480, 720);
      ctx.fillStyle = '#fff';
      ctx.font = '22px monospace';
      // ctx.fillText('GAME OVER', 170, 300);
      ctx.font = '14px monospace';
      ctx.fillText(
        `Score ${this.score()} | MaxCombo ${this.maxCombo()} | Time ${Math.floor(
          this.durationSec()
        )}s`,
        60,
        330
      );
    }
  }

  private preloadSprites(): Promise<void> {
    const setSrc = (im: HTMLImageElement, src: string) =>
      new Promise<void>((res) => {
        im.onload = () => res();
        im.src = src;
      });
    // crea frames de explosión
    this.explosionFrames = [new Image(), new Image(), new Image(), new Image()];

    return Promise.all([
      setSrc(this.img.ship, 'assets/sprites/ship.png'),
      setSrc(this.img.asteroid, 'assets/sprites/asteroid.png'),
      setSrc(this.img.bg, 'assets/sprites/bg.png'),
      setSrc(this.img.shoot, 'assets/sprites/shoot.png'),
      setSrc(
        this.explosionFrames[0],
        'assets/sprites/explosions/explosion1.png'
      ),
      setSrc(
        this.explosionFrames[1],
        'assets/sprites/explosions/explosion2.png'
      ),
      setSrc(
        this.explosionFrames[2],
        'assets/sprites/explosions/explosion3.png'
      ),
      setSrc(
        this.explosionFrames[3],
        'assets/sprites/explosions/explosion4.png'
      ),
    ]).then(() => {});
  }

  // arriba
  saving = signal(false);

  // submit
  private showError(msg: string) {
    this.errorMsg.set(msg);
    // autocierre opcional en 3.5 s
    setTimeout(() => {
      if (this.errorMsg() === msg) this.errorMsg.set(null);
    }, 3500);
  }
  
  // --- en submitAlias(...) reemplaza tu método por ---
  submitAlias(target: EventTarget | null) {
    if (!this.gameOver() || !target || this.saving()) return;
    const form = target as HTMLFormElement;
    const data = new FormData(form);
    const alias = String(data.get('alias') ?? '').trim();
  
    // Validación frontend
    if (alias.length < 3 || alias.length > 30) {
      this.showError('El alias debe tener entre 3 y 30 caracteres.');
      return;
    }
  
    const body = {
      alias,
      points: this.score(),
      maxCombo: this.maxCombo(),
      durationSec: Math.floor(this.durationSec()),
      metadata: `Dificultad: ${
        (history.state?.difficulty as string) ?? 'easy'
      } | Fecha: ${new Date().toLocaleString()}`,
    };
  
    this.saving.set(true);
    this.scores.postScore(body).subscribe({
      next: () => this.router.navigateByUrl('/ranking'),
      error: (err) => {
        this.saving.set(false);
        const msg =
          err?.error?.error ??
          'No se pudo guardar el puntaje. Intenta de nuevo.';
        this.showError(msg);
      },
    });
  }
  

  /*Botones */
  resume() {
    this.paused.set(false);
  }

  goMenu() {
    this.router.navigateByUrl('/');
  }
}
