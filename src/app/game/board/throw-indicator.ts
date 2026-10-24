import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslationService } from '../../core/i18n/translation';
import { ShapeMorphDirective } from '../../shared/shape-morph.directive';
import { DARTS_PER_TURN, DartInput, formatDart } from '../game.models';
import { TurnPreview } from '../turn-preview';

/** DOM id of the n-th dart slot (target of the trajectory animation). */
export function dartSlotId(index: number): string {
  return `dart-slot-${index}`;
}

type SlotColor = 'primary' | 'accent' | 'warn' | undefined;

interface Slot {
  readonly id: string;
  readonly label: string;
  readonly filled: boolean;
}

/**
 * Pending turn (template `dart-throw-indicator`): three dart slots, per-dart undo, the explicit
 * "confirm turn" button and the server-side undo of the own last turn.
 */
@Component({
  selector: 'app-throw-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, ShapeMorphDirective],
  templateUrl: './throw-indicator.html',
  styleUrl: './throw-indicator.scss',
})
export class ThrowIndicator {
  protected readonly i18n = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;

  readonly pending = input<readonly DartInput[]>([]);
  readonly preview = input<TurnPreview | null>(null);
  readonly busy = input(false);
  readonly canConfirm = input(false);
  readonly canUndoDart = input(false);
  readonly canUndoTurn = input(false);

  readonly confirm = output<void>();
  readonly undoDart = output<void>();
  readonly undoTurn = output<void>();

  /** Remaining seconds before auto-confirm (5 → 0). */
  protected readonly countdown = signal(0);

  /** Start or restart the countdown when the confirm button becomes enabled. */
  private startCountdown(): void {
    this.stopCountdown();
    this.countdown.set(5);
    this.countdownTimer = setTimeout(() => this.tickCountdown(), 1000);
  }

  private tickCountdown(): void {
    const next = this.countdown() - 1;
    if (next <= 0) {
      this.countdown.set(0);
      this.stopCountdown();
      // Auto-confirm only if still confirmable and not busy.
      if (this.canConfirm() && !this.busy()) {
        this.confirm.emit();
      }
      return;
    }
    this.countdown.set(next);
    this.countdownTimer = setTimeout(() => this.tickCountdown(), 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== null) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  /** Watch canConfirm: start countdown when it becomes true, stop when false. */
  private readonly countdownEffect = effect(() => {
    const canConfirm = this.canConfirm();
    if (canConfirm) {
      this.startCountdown();
    } else {
      this.stopCountdown();
      this.countdown.set(0);
    }
  });

  /**
   * Exposed for the template: resets the countdown when the user undoes a dart,
   * so the timer only fires when the user is idle.
   */
  protected onUndoDart(): void {
    this.stopCountdown();
    this.countdown.set(0);
    this.undoDart.emit();
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCountdown();
    });
  }

  protected readonly slots = computed<readonly Slot[]>(() =>
    Array.from({ length: DARTS_PER_TURN }, (_, i) => {
      const dart = this.pending()[i];
      return { id: dartSlotId(i), label: dart ? formatDart(dart) : '➶', filled: dart !== undefined };
    }),
  );
  /** Template `getProgressColor`: primary -> accent -> warn with the number of darts thrown. */
  protected readonly color = computed<SlotColor>(() => {
    switch (this.pending().length) {
      case 1:
        return 'primary';
      case 2:
        return 'accent';
      case 3:
        return 'warn';
      default:
        return undefined;
    }
  });
}
