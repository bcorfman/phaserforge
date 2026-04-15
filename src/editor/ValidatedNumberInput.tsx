import { useEffect, useMemo, useState } from 'react';

function coerceFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type BaseProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'onBlur'
>;

export function ValidatedNumberInput({
  value,
  onCommit,
  clamp,
  ...props
}: BaseProps & {
  value: number;
  onCommit: (next: number) => void;
  clamp?: (value: number) => number;
}) {
  const clampValue = useMemo(() => clamp ?? ((n: number) => n), [clamp]);
  const [draft, setDraft] = useState<string>(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const parsed = coerceFiniteNumber(draft);
    if (parsed === null) {
      setDraft(String(value));
      return;
    }
    const next = clampValue(parsed);
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      {...props}
      type="number"
      value={draft}
      onChange={(e) => {
        setEditing(true);
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(String(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
        props.onKeyDown?.(e);
      }}
    />
  );
}

export function ValidatedOptionalNumberInput({
  value,
  onCommit,
  clamp,
  ...props
}: BaseProps & {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  clamp?: (value: number) => number;
}) {
  const clampValue = useMemo(() => clamp ?? ((n: number) => n), [clamp]);
  const [draft, setDraft] = useState<string>(value === undefined ? '' : String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value === undefined ? '' : String(value));
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      onCommit(undefined);
      setDraft('');
      return;
    }
    const parsed = coerceFiniteNumber(trimmed);
    if (parsed === null) {
      setDraft(value === undefined ? '' : String(value));
      return;
    }
    const next = clampValue(parsed);
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      {...props}
      type="number"
      value={draft}
      onChange={(e) => {
        setEditing(true);
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(value === undefined ? '' : String(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
        props.onKeyDown?.(e);
      }}
    />
  );
}

