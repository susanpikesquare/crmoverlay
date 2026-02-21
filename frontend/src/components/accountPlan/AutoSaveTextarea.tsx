import { useState, useEffect, useRef, useCallback } from 'react';

interface AutoSaveTextareaProps {
  label: string;
  fieldName: string;
  value: string;
  placeholder: string;
  onChange: (field: string, value: string) => void;
  rows?: number;
}

export default function AutoSaveTextarea({
  label,
  fieldName,
  value,
  placeholder,
  onChange,
  rows = 4,
}: AutoSaveTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Auto-resize when value changes
  useEffect(() => {
    autoResize();
  }, [localValue, autoResize]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(fieldName, newValue);
    }, 500);
  }, [fieldName, onChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <textarea
        ref={textareaRef}
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y text-sm text-gray-900 placeholder-gray-400 overflow-hidden"
      />
    </div>
  );
}
