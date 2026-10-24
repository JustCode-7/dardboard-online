import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../core/i18n/translation';
import { Feedback } from '../../core/ux/feedback';
import { Fullscreen } from '../../core/ux/fullscreen';
import { GameBoard } from '../../game/board/game-board';
import { LobbyState } from '../../game/game.models';
import { LobbyStore } from '../../game/lobby-store';
import { GameActions } from '../../game/lobby/game-actions';
import { WaitingRoom } from '../../game/lobby/waiting-room';
import { FinishedView } from '../../game/result/finished-view';
import { winnerText } from '../../game/result/winner-text';

/**
 * `/game/:lobbyId` - shell of one lobby: load/offline/error states and the switch between
 * {@link WaitingRoom}, {@link GameBoard} and {@link FinishedView}.
 * `LobbyStore` is provided here so its Firestore listener lives exactly as long as this page.
 */
@Component({
  selector: 'app-game-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LobbyStore],
  imports: [
    FinishedView,
    GameActions,
    GameBoard,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    WaitingRoom,
  ],
  templateUrl: './game-page.html',
})
export class GamePage {
  protected readonly store = inject(LobbyStore);
  protected readonly i18n = inject(TranslationService);
  private readonly feedback = inject(Feedback);
  private readonly fullscreen = inject(Fullscreen);

  /** Route param, bound via `withComponentInputBinding()`. */
  readonly lobbyId = input.required<string>();

  protected readonly errorMessage = computed(() => {
    const code = this.store.error();
    return code ? this.i18n.errorMessage(code) : null;
  });

  constructor() {
    // Re-subscribe only when the route param changes; the store's own signals are not tracked.
    effect(() => {
      const id = this.lobbyId();
      untracked(() => this.store.watch(id));
    });

    // Celebrate the server-confirmed end once (transition IN_PROGRESS -> FINISHED, not on reload).
    let previousState: LobbyState | null = null;
    effect(() => {
      const state = this.store.lobby()?.state ?? null;
      const text = winnerText(this.i18n, this.store.winners(), this.store.uid());
      if (previousState === 'IN_PROGRESS' && state === 'FINISHED' && text) {
        untracked(() => this.feedback.winner(text));
      }
      previousState = state;
    });

    // Keep the display awake while a game is running (template behavior).
    effect(() => {
      if (this.store.lobby()?.state === 'IN_PROGRESS') {
        untracked(() => void this.fullscreen.requestWakeLock());
      }
    });
    inject(DestroyRef).onDestroy(() => void this.fullscreen.releaseWakeLock());
  }
}
