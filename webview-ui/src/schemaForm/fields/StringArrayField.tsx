interface StringArrayFieldProps {
  label: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
}

export function StringArrayField({
  label,
  description,
  value,
  onChange,
}: StringArrayFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
      <span className="text-xs text-gray-400">One entry per line.</span>
      <textarea
        className="rounded border border-gray-300 px-2 py-1 font-mono text-xs"
        rows={Math.min(8, Math.max(3, value.length + 1))}
        value={value.join('\n')}
        onChange={event =>
          onChange(event.target.value.split('\n').filter(line => line.length > 0))
        }
      />
    </label>
  );
}
