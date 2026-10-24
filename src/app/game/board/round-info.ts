import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation';

/** Round counter (template `round-info`): "Round 2 / 15", or just "Round 2" without a limit. */
@Component({
  selector: 'app-round-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './round-info.html',
  styleUrl: './round-info.scss',
})
export class RoundInfo {
  protected readonly i18n = inject(TranslationService);

  readonly round = input.required<number>();
  readonly maxRounds = input<number | null>(null);
}
