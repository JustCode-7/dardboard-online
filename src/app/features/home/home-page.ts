import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthSession, MAX_DISPLAY_NAME_LENGTH } from '../../core/auth-session';
import { errorCode } from '../../core/error-code';
import { TranslationService } from '../../core/i18n/translation';
import { GameApi } from '../../game/game-api';
import { LOBBY_ID_PATTERN } from '../../game/game.models';
import { GameModePicker, NewGameRequest } from './game-mode-picker';

/** Start page: choose a display name (anonymous auth), create a lobby or join one by id. */
@Component({
  selector: 'app-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, GameModePicker, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly i18n = inject(TranslationService);
  protected readonly session = inject(AuthSession);
  private readonly api = inject(GameApi);
  private readonly router = inject(Router);

  /** Bound from `?returnUrl=` (shared lobby links) via `withComponentInputBinding()`. */
  readonly returnUrl = input<string | undefined>(undefined);

  protected readonly maxNameLength = MAX_DISPLAY_NAME_LENGTH;
  protected readonly editingName = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly nameModel = signal({ displayName: '' });
  protected readonly nameForm = form(this.nameModel, path => {
    required(path.displayName);
    maxLength(path.displayName, MAX_DISPLAY_NAME_LENGTH);
  });

  protected readonly joinModel = signal({ lobbyId: '' });
  protected readonly joinForm = form(this.joinModel, path => {
    required(path.lobbyId);
    pattern(path.lobbyId, LOBBY_ID_PATTERN);
  });

  protected readonly showNameForm = computed(
    () => this.session.ready() && (!this.session.user()?.displayName || this.editingName()),
  );

  protected editName(): void {
    this.nameModel.set({ displayName: this.session.user()?.displayName ?? '' });
    this.editingName.set(true);
  }

  protected async saveName(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.nameForm, async () => {
      await this.run(async () => {
        await this.session.signIn(this.nameModel().displayName);
        this.editingName.set(false);
        const target = this.safeReturnUrl();
        if (target) {
          await this.router.navigateByUrl(target);
        }
      });
    });
  }

  protected async create(request: NewGameRequest): Promise<void> {
    await this.run(async () => {
      const { lobbyId } = await this.api.createLobby(request.gameMode, request.maxRounds);
      await this.router.navigate(['/game', lobbyId]);
    });
  }

  protected async join(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.joinForm, async () => {
      await this.run(async () => {
        const lobbyId = GameApi.normalizeLobbyId(this.joinModel().lobbyId);
        try {
          await this.api.joinLobby(lobbyId);
        } catch (e: unknown) {
          // Already seated (e.g. after a reconnect): simply open the game again.
          if (errorCode(e) !== 'functions/already-exists') {
            throw e;
          }
        }
        await this.router.navigate(['/game', lobbyId]);
      });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e: unknown) {
      this.error.set(this.i18n.errorMessage(errorCode(e)));
    } finally {
      this.busy.set(false);
    }
  }

  /** Only same-app relative paths are followed (prevents open redirects via `returnUrl`). */
  private safeReturnUrl(): string | null {
    const url = this.returnUrl();
    return url && url.startsWith('/game/') && !url.startsWith('//') ? url : null;
  }
}
