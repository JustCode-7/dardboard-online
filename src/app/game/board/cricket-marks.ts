import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CRICKET_FIELDS, CRICKET_MARKS_TO_CLOSE, marksOn, PlayerView } from '../game.models';

interface MarkCell {
  readonly field: number;
  readonly label: string;
  readonly marks: number;
  readonly closed: boolean;
}

/** Cricket miniature per player (template `cricket-mini-display`): circles 15-20/B with mark counts. */
@Component({
  selector: 'app-cricket-marks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cricket-marks.html',
  styleUrl: './cricket-marks.scss',
})
export class CricketMarks {
  readonly player = input.required<PlayerView>();

  protected readonly cells = computed<readonly MarkCell[]>(() =>
    CRICKET_FIELDS.map(field => {
      const marks = marksOn(this.player(), field);
      return { field, label: field === 25 ? 'B' : String(field), marks, closed: marks >= CRICKET_MARKS_TO_CLOSE };
    }),
  );
}
