import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, ViewChild, signal, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ScoreHttpService } from '../../infrastructure/score/score.http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type Vec = { x: number; y: number; w: number; h: number; vx?: number; vy?: number; alive?: boolean; };

@Component({
  selector: 'app-play',
  standalone: true,
  templateUrl: './play.page.html',
  styleUrl: './play.page.css'
})
export class PlayPage implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

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
  private player: Vec = { x: 220, y: 660, w: 40, h: 40 };
  private bullets: Vec[] = [];
  private enemies: Vec[] = [];
  private spawnMs = 900; // se ajusta por dificultad
  private lastSpawn = 0;

  private readonly router = inject(Router);
  private readonly scores = inject(ScoreHttpService);
  private readonly destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    const c = this.canvasRef.nativeElement;
    c.width = 480; c.height = 720;
    const ctx = c.getContext('2d'); if (!ctx) return; this.ctx = ctx;

    // dificultad desde navigation state
    const st = history.state as { difficulty?: 'easy'|'normal'|'hard' };
    this.setDifficulty(st?.difficulty ?? 'easy');

    // input
    window.addEventListener('keydown', this.onKey, false);
    window.addEventListener('keyup', this.onKey, false);

    this.loop(0);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.req);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }

  private setDifficulty(d: 'easy'|'normal'|'hard') {
    if (d === 'easy') this.spawnMs = 900;
    else if (d === 'normal') this.spawnMs = 650;
    else this.spawnMs = 450;
  }

  togglePause() {
    if (this.gameOver()) return;
    this.paused.update(v => !v);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.type === 'keydown') {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { this.togglePause(); return; }
      this.keys[e.key] = true;
      if (e.key === ' ') this.shoot();
    } else {
      this.keys[e.key] = false;
    }
  };

  private shoot() {
    if (this.paused() || this.gameOver()) return;
    this.bullets.push({ x: this.player.x + this.player.w/2 - 3, y: this.player.y - 10, w: 6, h: 12, vy: -10, alive: true });
  }

  private spawnEnemy() {
    const x = Math.random() * (480 - 36);
    this.enemies.push({ x, y: -36, w: 36, h: 36, vy: 2 + Math.random()*1.5, alive: true });
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
    this.durationSec.update(t => t + dt);

    // input
    const speed = 240 * dt;
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) this.player.x -= speed;
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) this.player.x += speed;
    this.player.x = Math.max(0, Math.min(480 - this.player.w, this.player.x));

    // spawn
    if (ts - this.lastSpawn > this.spawnMs) { this.spawnEnemy(); this.lastSpawn = ts; }

    // update bullets
    for (const b of this.bullets) { if (!b.alive) continue; b.y += b.vy!; if (b.y < -20) b.alive = false; }

    // update enemies
    for (const en of this.enemies) { if (!en.alive) continue; en.y += en.vy!; if (en.y > 760) { en.alive = false; this.combo.set(0); this.life.update(l => Math.max(0, l - 10)); } }

    // collisions bullets vs enemies
    for (const b of this.bullets) if (b.alive) {
      for (const en of this.enemies) if (en.alive) {
        if (this.aabb(b, en)) { b.alive = false; en.alive = false; this.combo.update(c => c + 1); this.maxCombo.update(m => Math.max(m, this.combo())); this.score.update(s => s + 100 * this.combo()); }
      }
    }

    // enemy vs player
    for (const en of this.enemies) if (en.alive && this.aabb(en, this.player)) {
      en.alive = false;
      this.combo.set(0);
      this.life.update(l => Math.max(0, l - 25));
    }

    if (this.life() <= 0) this.gameOver.set(true);

    // compact arrays
    this.bullets = this.bullets.filter(b => b.alive);
    this.enemies = this.enemies.filter(e => e.alive);

    this.render();
  };

  private aabb(a: Vec, b: Vec): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 480, 720);

    // background
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,480,720);

    // player
    ctx.fillStyle = '#4af';
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

    // bullets
    ctx.fillStyle = '#fff';
    for (const b of this.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

    // enemies
    ctx.fillStyle = '#f55';
    for (const e of this.enemies) ctx.fillRect(e.x, e.y, e.w, e.h);

    // HUD
    ctx.fillStyle = '#0f0'; ctx.font = '14px monospace';
    ctx.fillText(`Score: ${this.score()}`, 10, 20);
    ctx.fillText(`Life: ${this.life()}`, 10, 40);
    ctx.fillText(`Combo: ${this.combo()} (max ${this.maxCombo()})`, 10, 60);
    ctx.fillText(`Time: ${this.durationSec().toFixed(1)}s`, 10, 80);

    if (this.paused()) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,480,720);
      ctx.fillStyle = '#fff'; ctx.font = '28px monospace'; ctx.fillText('JUEGO EN PAUSA', 110, 360);
    }

    if (this.gameOver()) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0,0,480,720);
      ctx.fillStyle = '#fff'; ctx.font = '22px monospace';
      ctx.fillText('GAME OVER', 170, 300);
      ctx.font = '14px monospace';
      ctx.fillText(`Score ${this.score()} | MaxCombo ${this.maxCombo()} | Time ${Math.floor(this.durationSec())}s`, 60, 330);
    }
  }

  submitAlias(target: EventTarget | null) {
    if (!this.gameOver() || !target) return;
    const form = target as HTMLFormElement;
    const data = new FormData(form);
    const alias = String(data.get('alias') ?? '').trim();
    if (alias.length < 3) return;
    this.scores.postScore({
      alias,
      points: this.score(),
      maxCombo: this.maxCombo(),
      durationSec: Math.floor(this.durationSec()),
      metadata: { version: 'ng19' }
    }).subscribe(() => this.router.navigateByUrl('/ranking'));
  }
  
}
