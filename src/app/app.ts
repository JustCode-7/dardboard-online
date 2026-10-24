import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppToolbar } from './core/ux/app-toolbar';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppToolbar, RouterOutlet],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
