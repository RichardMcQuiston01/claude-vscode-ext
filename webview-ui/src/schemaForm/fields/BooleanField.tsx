interface BooleanFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanField({
  label,
  description,
  value,
  onChange,
}: BooleanFieldProps) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={value}
        onChange={event => onChange(event.target.checked)}
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </span>
    </label>
  );
}
