import { DOCUMENT, inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BULL_SEGMENT, DartInput, MISS_SEGMENT } from '../../game/game.models';
import { SoundSettings } from './sound-settings';

export type ExplosionColor = 'default' | 'red' | 'green' | 'blue';

interface Point {
  readonly x: number;
  readonly y: number;
}

const EXPLOSION_MS = 1500;
const PARTICLES = 40;
const TRAILS = 20;
const TRAJECTORY_MS = 1000;
const TRAJECTORY_ARROWS = 3;
const TRAJECTORY_STAGGER_MS = 300;
const TRAIL_MS = 500;
/** Arrow sprite size (32x12), used to center it on the path. */
const ARROW_HALF_WIDTH = 16;
const ARROW_HALF_HEIGHT = 6;
const ARC_HEIGHT_PX = 150;
export const ARROW_IMAGE = 'assets/image/pfeil.svg';

export const SOUNDS = {
  bull: 'assets/sounds/cow-moo-sound-effect.mp3',
  bullseye: 'assets/sounds/oh-yeah.mp3',
  double: 'assets/sounds/ship-bell-two-times.mp3',
  triple: 'assets/sounds/firework-explosion.mp3',
  tripleTwenty: 'assets/sounds/good-result.mp3',
  oneEighty: 'assets/sounds/opening-bell-triple.mp3',
  tripleTriple: 'assets/sounds/oh-yeah.mp3',
  bust: 'assets/sounds/sitcom-laugh.mp3',
  miss: 'assets/sounds/double-car-horn.mp3',
  win: 'assets/sounds/fanfare-trumpets.mp3',
} as const;

/**
 * Instant visual/audio feedback (template's `ExplosionAnimationService`). Purely cosmetic: it reacts to
 * local input immediately (<100 ms) and never influences game state.
 */
@Injectable({ providedIn: 'root' })
export class Feedback {
  private readonly document = inject(DOCUMENT);
  private readonly sound = inject(SoundSettings);
  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);
  private explosion: HTMLElement | null = null;
  private removeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly arrowUrl: string;

  constructor() {
    // Resolved against <base href> so it also works under the GitHub Pages sub-path; preloaded so the
    // first animation does not wait for the network (template `preloadAssets`).
    this.arrowUrl = new URL(ARROW_IMAGE, this.document.baseURI).href;
    if (typeof Image !== 'undefined') {
      new Image().src = this.arrowUrl;
    }
  }

  /**
   * Feedback for a locally accepted dart. `turn` contains all pending darts including `dart`
   * (used for the template's 180 / "TripleTriple" specials).
   */
  dart(dart: DartInput, turn: readonly DartInput[]): void {
    if (dart.segment === MISS_SEGMENT) {
      this.play(SOUNDS.miss);
      return;
    }
    if (dart.segment === BULL_SEGMENT) {
      if (dart.multiplier === 2) {
        this.showExplosion('Bullseye', 'red', SOUNDS.bullseye);
      } else {
        this.play(SOUNDS.bull);
      }
      return;
    }
    if (dart.multiplier === 2) {
      this.play(SOUNDS.double);
      return;
    }
    if (dart.multiplier === 3) {
      const triples = turn.filter(d => d.multiplier === 3 && d.segment !== BULL_SEGMENT);
      if (triples.length === 3 && triples.every(d => d.segment === 20)) {
        this.showExplosion('180', 'red', SOUNDS.oneEighty);
      } else if (triples.length === 3) {
        this.showExplosion(`TripleTriple: T${dart.segment}`, 'red', SOUNDS.tripleTriple);
      } else {
        this.showExplosion(`T${dart.segment}`, 'red', dart.segment === 20 ? SOUNDS.tripleTwenty : SOUNDS.triple);
      }
    }
  }

  bust(): void {
    this.play(SOUNDS.bust);
  }

  winner(text: string): void {
    this.showExplosion(text, 'green', SOUNDS.win, true);
  }

  showExplosion(text: string, color: ExplosionColor, audioSrc: string | null, winner = false): void {
    this.removeExplosion();
    const body = this.document.body;
    const container = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(container, 'explosion-container');
    this.renderer.setAttribute(container, 'aria-hidden', 'true');
    if (winner) {
      this.renderer.addClass(container, 'winner-animated-position');
    }
    const explosion = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(explosion, 'explosion');
    if (color !== 'default') {
      this.renderer.addClass(explosion, `explosion-${color}`);
    }
    for (let i = 0; i < PARTICLES; i++) {
      const particle = this.renderer.createElement('div');
      this.renderer.addClass(particle, 'explosion-particle');
      this.renderer.appendChild(explosion, particle);
    }
    for (let i = 0; i < TRAILS; i++) {
      const trail = this.renderer.createElement('div');
      this.renderer.addClass(trail, 'explosion-trail');
      this.renderer.appendChild(explosion, trail);
    }
    const label = this.renderer.createElement('div');
    this.renderer.addClass(label, 'explosion-text');
    this.renderer.setProperty(label, 'textContent', text);
    this.renderer.appendChild(explosion, label);
    this.renderer.appendChild(container, explosion);
    this.renderer.appendChild(body, container);
    this.explosion = container;

    if (audioSrc) {
      this.play(audioSrc);
    }
    this.removeTimer = setTimeout(() => this.removeExplosion(), EXPLOSION_MS);
  }

  /**
   * Template `showTrajectory`: three arrows fly on a ballistic arc (quadratic Bezier, rotated along the
   * tangent, with a sparkle trail) from the pressed button to the dart slot.
   */
  trajectory(source: Element, target: Element): void {
    const view = this.document.defaultView;
    if (!view || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const start = { x: from.left + from.width / 2 - ARROW_HALF_WIDTH, y: from.top + from.height / 2 - ARROW_HALF_HEIGHT };
    const end = { x: to.left + to.width / 2 - ARROW_HALF_WIDTH, y: to.top + to.height / 2 - ARROW_HALF_HEIGHT };
    const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - ARC_HEIGHT_PX };

    const container = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(container, 'trajectory-container');
    this.renderer.setAttribute(container, 'aria-hidden', 'true');
    this.renderer.appendChild(this.document.body, container);

    for (let i = 0; i < TRAJECTORY_ARROWS; i++) {
      view.setTimeout(() => this.flyArrow(view, container, start, control, end), i * TRAJECTORY_STAGGER_MS);
    }
    view.setTimeout(
      () => container.remove(),
      TRAJECTORY_MS + TRAJECTORY_ARROWS * TRAJECTORY_STAGGER_MS + TRAIL_MS,
    );
  }

  private flyArrow(view: Window, container: HTMLElement, start: Point, control: Point, end: Point): void {
    const arrow = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(arrow, 'trajectory-particle');
    this.renderer.setStyle(arrow, 'background-image', `url("${this.arrowUrl}")`);
    this.renderer.appendChild(container, arrow);
    const startTime = view.performance.now();

    const step = (now: number): void => {
      const t = Math.min((now - startTime) / TRAJECTORY_MS, 1);
      const u = 1 - t;
      const x = u * u * start.x + 2 * u * t * control.x + t * t * end.x;
      const y = u * u * start.y + 2 * u * t * control.y + t * t * end.y;
      const dx = 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x);
      const dy = 2 * u * (control.y - start.y) + 2 * t * (end.y - control.y);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      this.renderer.setStyle(arrow, 'transform', `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`);
      this.renderer.setStyle(arrow, 'opacity', String(t < 0.1 ? t * 10 : (1 - t) * 2));
      if (Math.random() > 0.7) {
        this.sparkle(view, container, x + ARROW_HALF_WIDTH, y + ARROW_HALF_HEIGHT);
      }
      if (t < 1) {
        view.requestAnimationFrame(step);
      } else {
        arrow.remove();
      }
    };
    view.requestAnimationFrame(step);
  }

  private sparkle(view: Window, container: HTMLElement, x: number, y: number): void {
    const trail = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(trail, 'trajectory-trail');
    this.renderer.setStyle(trail, 'left', `${x}px`);
    this.renderer.setStyle(trail, 'top', `${y}px`);
    this.renderer.appendChild(container, trail);
    view.setTimeout(() => trail.remove(), TRAIL_MS);
  }

  play(src: string): void {
    if (!this.sound.enabled()) {
      return;
    }
    try {
      const audio = new Audio(src);
      audio.volume = 0.5;
      // Autoplay may be blocked before the first user gesture; that is not an error for the game.
      audio.play().catch(() => undefined);
    } catch {
      // Audio unsupported (e.g. test environment).
    }
  }

  private removeExplosion(): void {
    if (this.removeTimer) {
      clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }
    if (this.explosion?.isConnected) {
      this.renderer.removeChild(this.document.body, this.explosion);
    }
    this.explosion = null;
  }
}
