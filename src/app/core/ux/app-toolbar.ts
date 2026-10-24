import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../i18n/translation';
import { Fullscreen } from './fullscreen';
import { PwaInstall } from './pwa-install';
import { SoundSettings } from './sound-settings';

/** Global toolbar (template's `AppToolbarComponent`): menu, fullscreen, sound, language, PWA install. */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatSlideToggleModule, MatToolbarModule, MatTooltipModule, RouterLink],
  templateUrl: './app-toolbar.html',
  styleUrl: './app-toolbar.scss',
})
export class AppToolbar {
  protected readonly i18n = inject(TranslationService);
  protected readonly sound = inject(SoundSettings);
  protected readonly fullscreen = inject(Fullscreen);
  protected readonly pwa = inject(PwaInstall);

  protected onSoundChange(change: MatSlideToggleChange): void {
    this.sound.setEnabled(change.checked);
  }
}
