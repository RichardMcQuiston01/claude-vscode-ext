import {useState} from 'react';

interface JsonFallbackFieldProps {
  label: string;
  description?: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Editor of last resort for a schema shape `classifyField` doesn't have a
 * dedicated widget for yet (unions, free-form maps, arrays of non-strings,
 * unresolvable `$ref`s). Still a form field the setting can be edited
 * through — just its raw JSON — rather than the setting being silently
 * dropped from the form.
 */
export function JsonFallbackField({
  label,
  description,
  value,
  onChange,
}: JsonFallbackFieldProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
      <span className="text-xs text-amber-600">
        No dedicated editor for this setting's shape yet — edit its raw
        JSON.
      </span>
      <textarea
        className="rounded border border-gray-300 px-2 py-1 font-mono text-xs"
        rows={6}
        value={text}
        onChange={event => {
          const nextText = event.target.value;
          setText(nextText);
          try {
            onChange(JSON.parse(nextText));
            setError(undefined);
          } catch (parseError) {
            setError(
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
            );
          }
        }}
      />
      {error && (
        <span className="text-xs text-red-600">Invalid JSON: {error}</span>
      )}
    </label>
  );
}
