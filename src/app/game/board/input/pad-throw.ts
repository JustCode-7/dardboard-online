import { DartInput } from '../../game.models';

/** A dart entered on a pad plus the pressed button (start point of the trajectory animation). */
export interface PadThrow {
  readonly dart: DartInput;
  readonly origin: HTMLElement;
}
