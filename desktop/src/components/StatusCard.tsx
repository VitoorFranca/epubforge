import type { Status } from '../types';
import './StatusCard.css';

interface Props {
  status: Status;
}

export function StatusCard({ status }: Props) {
  if (status.kind === 'idle') return null;

  return (
    <div className={`status-card status-card--${status.kind}`}>
      {status.kind === 'generating' && 'Gerando EPUB...'}
      {status.kind === 'done' && `✓ Concluído: ${status.title}`}
    </div>
  );
}
