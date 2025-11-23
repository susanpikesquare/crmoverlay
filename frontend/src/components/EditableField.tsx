import { useState, useRef, useEffect } from 'react';

interface EditableFieldProps {
  value: string | number | null;
  fieldName: string;
  fieldType?: string;
  label: string;
  canEdit: boolean;
  onSave: (fieldName: string, newValue: any) => Promise<void>;
  formatter?: (value: any) => string;
  className?: string;
}

export default function EditableField({
  value,
  fieldName,
  fieldType = 'text',
  label,
  canEdit,
  onSave,
  formatter,
  className = '',
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Update editValue when value prop changes (e.g., after save)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value?.toString() || '');
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    if (!canEdit) return;
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value?.toString() || '');
    setError(null);
  };

  const handleSave = async () => {
    if (editValue === value?.toString()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Convert value based on field type
      let convertedValue: any = editValue;

      if (fieldType === 'currency' || fieldType === 'double' || fieldType === 'percent') {
        convertedValue = editValue ? parseFloat(editValue) : null;
      } else if (fieldType === 'int') {
        convertedValue = editValue ? parseInt(editValue, 10) : null;
      } else if (fieldType === 'boolean') {
        convertedValue = editValue === 'true';
      }

      await onSave(fieldName, convertedValue);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = formatter && value !== null && value !== undefined
    ? formatter(value)
    : (value?.toString() || '—');

  const getInputType = () => {
    if (fieldType === 'currency' || fieldType === 'double' || fieldType === 'percent') return 'number';
    if (fieldType === 'int') return 'number';
    if (fieldType === 'date') return 'date';
    if (fieldType === 'email') return 'email';
    if (fieldType === 'url') return 'url';
    if (fieldType === 'phone') return 'tel';
    return 'text';
  };

  const isTextarea = fieldType === 'textarea';

  return (
    <div className={`group ${className}`}>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>

      {!isEditing ? (
        <div
          onClick={handleEdit}
          className={`
            min-h-[32px] px-3 py-2 rounded-lg border border-transparent
            ${canEdit ? 'cursor-pointer hover:bg-purple-50 hover:border-purple-200 transition' : 'cursor-default'}
            ${value ? 'text-gray-900' : 'text-gray-400'}
          `}
          title={canEdit ? 'Click to edit' : 'Read-only field'}
        >
          <div className="flex items-center justify-between">
            <span>{displayValue}</span>
            {canEdit && (
              <svg
                className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            )}
          </div>
        </div>
      ) : (
        <div>
          {isTextarea ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
              rows={3}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={getInputType()}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              step={fieldType === 'currency' || fieldType === 'double' ? '0.01' : undefined}
              className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
            />
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition"
            >
              Cancel
            </button>
            <span className="text-xs text-gray-500">Press Enter to save, Esc to cancel</span>
          </div>

          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
