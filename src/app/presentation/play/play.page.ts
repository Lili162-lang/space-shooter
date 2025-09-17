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

@Component({
  selector: 'app-play',
  standalone: true,
  templateUrl: './play.page.html',
  styleUrl: './play.page.css',
})
export class PlayPage implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Expose Math to template
  Math = Math;

  // HUD
  score = signal(0);
  life = signal(100);
  combo = signal(0);
  maxCombo = signal(0);
  durationSec = signal(0);
  paused = signal(false);
  gameOver = signal(false);

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

  ngAfterViewInit(): void {
    const c = this.canvasRef.nativeElement;
    c.width = 480;
    c.height = 720;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

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
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.req);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
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
      angle: Math.random() * Math.PI * 2,           // arranca en ángulo random
    spin: (Math.random() - 0.5) * 0.1 
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
        this.life.update(l => Math.max(0, l - 10));
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
              this.combo.update((c) => c + 1);
              this.maxCombo.update((m) => Math.max(m, this.combo()));
              this.score.update((s) => s + 100 * this.combo());
            }
          }
      }

    // enemy vs player
    for (const en of this.enemies)
      if (en.alive && this.aabb(en, this.player)) {
        en.alive = false;
        this.combo.set(0);
        this.life.update((l) => Math.max(0, l - 25));
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

    return Promise.all([
      setSrc(this.img.ship, 'assets/sprites/ship.png'),
      setSrc(this.img.asteroid, 'assets/sprites/asteroid.png'),
      setSrc(this.img.bg, 'assets/sprites/bg.png'),
      setSrc(this.img.shoot, 'assets/sprites/shoot.png'),
    ]).then(() => {});
  }

  // arriba
saving = signal(false);

// submit
submitAlias(target: EventTarget | null) {
  if (!this.gameOver() || !target || this.saving()) return;
  const form = target as HTMLFormElement;
  const data = new FormData(form);
  const alias = String(data.get('alias') ?? '').trim();
  if (alias.length < 3) return;

  const body = {
    alias,
    points: this.score(),
    maxCombo: this.maxCombo(),
    durationSec: Math.floor(this.durationSec()),
    // Texto plano para metadata
    metadata: `Dificultad: ${(history.state?.difficulty as string) ?? 'easy'} | Fecha: ${new Date().toLocaleString()}`
  };

  this.saving.set(true);
  this.scores.postScore(body).subscribe({
    next: () => this.router.navigateByUrl('/ranking'),
    error: () => this.saving.set(false)
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
