interface NumberFieldProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}

export function NumberField({
  label,
  description,
  value,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
      <input
        type="number"
        className="rounded border border-gray-300 px-2 py-1"
        value={Number.isFinite(value) ? value : ''}
        onChange={event => {
          const next = event.target.valueAsNumber;
          onChange(Number.isNaN(next) ? 0 : next);
        }}
      />
    </label>
  );
}
