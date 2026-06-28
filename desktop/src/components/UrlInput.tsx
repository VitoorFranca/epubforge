import './UrlInput.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function UrlInput({ value, onChange, disabled }: Props) {
  return (
    <div className="url-input">
      <label htmlFor="url-field" className="url-label">
        URL
      </label>
      <input
        id="url-field"
        type="url"
        className="url-field"
        placeholder="https://..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.form?.requestSubmit();
        }}
        disabled={disabled}
        autoFocus
        spellCheck={false}
      />
    </div>
  );
}
