import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslationService } from '../../../core/i18n/translation';
import { ShapeMorphDirective } from '../../../shared/shape-morph.directive';

/** Miss button (template `MissBtn`); emits the pressed element. */
@Component({
  selector: 'app-miss-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, ShapeMorphDirective],
  templateUrl: './miss-button.html',
})
export class MissButton {
  protected readonly i18n = inject(TranslationService);

  readonly disabled = input(false);
  readonly miss = output<HTMLElement>();
}
