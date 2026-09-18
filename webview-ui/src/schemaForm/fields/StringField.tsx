interface StringFieldProps {
  label: string;
  description?: string;
  value: string;
  enumValues?: string[];
  allowCustom?: boolean;
  onChange: (value: string) => void;
}

export function StringField({
  label,
  description,
  value,
  enumValues,
  allowCustom,
  onChange,
}: StringFieldProps) {
  const datalistId = allowCustom ? `${label}-suggestions` : undefined;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
      {enumValues && !allowCustom ? (
        <select
          className="rounded border border-gray-300 px-2 py-1"
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          <option value="" disabled hidden>
            Select…
          </option>
          {enumValues.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className="rounded border border-gray-300 px-2 py-1"
          value={value}
          list={datalistId}
          onChange={event => onChange(event.target.value)}
        />
      )}
      {datalistId && enumValues && (
        <datalist id={datalistId}>
          {enumValues.map(option => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </label>
  );
}
