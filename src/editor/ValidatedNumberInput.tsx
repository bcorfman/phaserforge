import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

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

type BaseTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur'
>;

export function ValidatedNumberInput({
  value,
  onCommit,
  onLiveChange,
  clamp,
  ...props
}: BaseProps & {
  value: number;
  onCommit: (next: number) => void;
  onLiveChange?: (next: number) => void;
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
        const raw = e.target.value;
        setDraft(raw);
        if (onLiveChange) {
          const parsed = coerceFiniteNumber(raw);
          if (parsed !== null) onLiveChange(clampValue(parsed));
        }
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

export function ValidatedNumberTextInput({
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
      type="text"
      inputMode="decimal"
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

export const ValidatedTextareaInput = forwardRef<HTMLTextAreaElement, BaseTextareaProps & {
  value: string;
  onCommit: (next: string) => void;
  onLiveChange?: (next: string) => void;
  onFinalize?: (reason: 'enter' | 'escape' | 'blur') => void;
}>(function ValidatedTextareaInput({
  value,
  onCommit,
  onLiveChange,
  onFinalize,
  ...props
}, ref) {
  const [draft, setDraft] = useState<string>(value);
  const [editing, setEditing] = useState(false);
  const baselineRef = useRef(value);
  const blurModeRef = useRef<'commit' | 'revert' | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
      baselineRef.current = value;
    }
  }, [editing, value]);

  const commit = (next: string, force = false) => {
    setEditing(false);
    if (force || next !== value) onCommit(next);
    setDraft(next);
    baselineRef.current = next;
  };

  return (
    <textarea
      {...props}
      ref={ref}
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        if (!editing) baselineRef.current = value;
        setEditing(true);
        setDraft(next);
        onLiveChange?.(next);
      }}
      onBlur={(e) => {
        const blurMode = blurModeRef.current;
        blurModeRef.current = null;
        if (blurMode === 'revert') {
          const baseline = baselineRef.current;
          commit(baseline, true);
          onFinalize?.('escape');
        } else {
          commit(draft);
          onFinalize?.(blurMode === 'commit' ? 'enter' : 'blur');
        }
        props.onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          blurModeRef.current = 'commit';
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const baseline = baselineRef.current;
          setDraft(baseline);
          onLiveChange?.(baseline);
          blurModeRef.current = 'revert';
          e.currentTarget.blur();
        }
        props.onKeyDown?.(e);
      }}
    />
  );
});
