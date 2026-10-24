import { TranslationService } from '../../core/i18n/translation';
import { PlayerView } from '../game.models';

/** "You won!", "Alice wins!" or "Draw: Alice & Bob" (round-limit tie). */
export function winnerText(i18n: TranslationService, winners: readonly PlayerView[], uid: string | null): string {
  if (winners.length > 1) {
    return i18n.t('finished.draw', { names: winners.map(p => p.displayName).join(' & ') });
  }
  const winner = winners[0];
  if (!winner) {
    return '';
  }
  return winner.playerId === uid ? i18n.t('finished.youWon') : i18n.t('finished.winner', { name: winner.displayName });
}
