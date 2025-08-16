import React from 'react';
import { formatNumberWithCommas, convertNumberToPersianWords, cleanNumber } from '../utils/numberUtils';

interface PriceInputProps {
  id?: string;
  name?: string;
  value: string | number; // The raw numeric value from the parent state
  onChange: (e: { target: { name: string; value: string } }) => void; // Emulate input event with raw numeric string value
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const PriceInput: React.FC<PriceInputProps> = ({ value, onChange, id, name = '', placeholder, className, disabled }) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = cleanNumber(e.target.value);
    // Propagate change up with a clean, raw numeric string
    onChange({ target: { name, value: cleanedValue } });
  };

  const displayValue = formatNumberWithCommas(value);
  const words = convertNumberToPersianWords(String(value));

  return (
    <div className="w-full">
      <input
        type="text" // Use text to allow for comma formatting
        inputMode="decimal" // Better mobile keyboard
        id={id}
        name={name}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
        dir="ltr" // Keep input ltr for number entry
      />
      {/* Helper text for words, with a fixed height to prevent layout shifts */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right h-4">
        {words}
      </div>
    </div>
  );
};

export default PriceInput;
