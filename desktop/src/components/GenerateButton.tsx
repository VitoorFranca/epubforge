import './GenerateButton.css';

interface Props {
  onClick: () => void;
  disabled: boolean;
}

export function GenerateButton({ onClick, disabled }: Props) {
  return (
    <button className="generate-button" onClick={onClick} disabled={disabled}>
      Gerar EPUB
    </button>
  );
}
