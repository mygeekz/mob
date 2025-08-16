
import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, SelectSingleEventHandler, ClassNames, Formatters, DayPickerProps } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import moment from 'jalali-moment';
import type { Locale, DateLibOptions } from 'react-day-picker';

interface ShamsiDatePickerProps {
  selectedDate: Date | null | undefined;
  onDateChange: (date: Date | null) => void;
  placeholderText?: string;
  inputClassName?: string;
  id?: string;
  disabled?: boolean;
}

const formatCaptionShamsi = (date: Date, options?: { locale?: Locale }): string => {
    return moment(date).locale('fa').format('jMMMM jYYYY');
};
  
const formatWeekdayNameShamsi = (date: Date, options?: { locale?: Locale }): string => {
    return moment(date).locale('fa').format('dd');
};
  
const formatDayShamsi = (date: Date, options?: { locale?: Locale }): string => {
    return moment(date).locale('fa').format('jD');
};

const shamsiFnsLocale: Locale = {
  code: 'fa-IR',
  formatDistance: (token, count, options) => {
    return `${count} ${token}`; 
  },
  formatRelative: (token, date, baseDate, options) => {
    return moment(date).locale('fa').from(moment(baseDate));
  },
  localize: {
    ordinalNumber: (n, options) => String(n),
    era: (era, options) => (era === 0 ? 'ق.م' : 'ه.ش'),
    quarter: (q, options) => {
      const quarters = ['سه‌ماهه اول', 'سه‌ماهه دوم', 'سه‌ماهه سوم', 'سه‌ماهه چهارم'];
      return quarters[q - 1];
    },
    month: (monthIndex, options) => {
      return moment.localeData('fa').jMonths()[monthIndex];
    },
    day: (dayIndex, options) => { 
      const momentFaWeekdays = moment.localeData('fa').weekdays(); 
      const momentFaWeekdaysShort = moment.localeData('fa').weekdaysShort(); 
      const mappedIndex = (dayIndex + 1) % 7; 

      if (options?.width === 'short') return momentFaWeekdaysShort[mappedIndex];
      if (options?.width === 'narrow') return moment.localeData('fa').weekdaysMin()[mappedIndex];
      return momentFaWeekdays[mappedIndex];
    },
    dayPeriod: (period, options) => {
      if (options?.width === 'narrow') {
        return period === 'am' ? 'ق' : 'ب';
      }
      return period === 'am' ? 'ق.ظ' : 'ب.ظ';
    },
  },
  formatLong: { 
    date: () => 'jYYYY/jMM/jDD',
    time: () => 'HH:mm:ss',
    dateTime: () => 'jYYYY/jMM/jDD HH:mm:ss',
    LT: () => 'HH:mm',            
    LTS: () => 'HH:mm:ss',       
    L: () => 'jYYYY/jMM/jDD',    
    LL: () => 'jD jMMMM jYYYY',  
    LLL: () => 'jD jMMMM jYYYY HH:mm', 
    LLLL: () => 'dddd، jD jMMMM jYYYY HH:mm', 
    l: () => 'jYYYY/jM/jD',      
    ll: () => 'jD jMMM jYYYY',   
    lll: () => 'jD jMMM jYYYY HH:mm',
    llll: () => 'ddd، jD jMMM jYYYY HH:mm',
  },
  match: { 
    ordinalNumber: (str) => ({ value: parseInt(str, 10), rest: '' }),
    era: (str) => (str === 'ه.ش' ? {value: 1, rest: ''} : (str === 'ق.م' ? {value: 0, rest: ''} : null)),
    quarter: (str) => {
        const num = parseInt(str.replace('سه‌ماهه ', ''), 10);
        return (num >= 1 && num <= 4) ? {value: num as 1|2|3|4, rest: ''} : null;
    },
    month: (str) => {
        const monthIndex = moment.localeData('fa').jMonths().indexOf(str);
        return monthIndex !== -1 ? {value: monthIndex, rest: ''} : null;
    },
    day: (str) => {
        const dayIndex = moment.localeData('fa').weekdays().indexOf(str);
        return dayIndex !== -1 ? {value: (dayIndex + 6) % 7, rest: ''} : null; 
    },
    dayPeriod: (str) => {
        if (str === 'ق.ظ' || str === 'ق') return {value: 'am', rest: ''};
        if (str === 'ب.ظ' || str === 'ب') return {value: 'pm', rest: ''};
        return null;
    }
  },
  options: {
    weekStartsOn: 6, 
    firstWeekContainsDate: 1, 
  },
};

const shamsiFormatters: Formatters = {
    formatCaption: formatCaptionShamsi as (month: Date, options?: DateLibOptions) => string,
    formatWeekdayName: formatWeekdayNameShamsi as (weekday: Date, options?: DateLibOptions) => string,
    formatDay: formatDayShamsi as (day: Date, options?: DateLibOptions) => string,
};


const ShamsiDatePicker: React.FC<ShamsiDatePickerProps> = ({
  selectedDate,
  onDateChange,
  placeholderText = "انتخاب تاریخ شمسی",
  inputClassName = "w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right",
  id,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedDate) {
      setInputValue(moment(selectedDate).locale('fa').format('jYYYY/jMM/jDD')); // Use jYYYY/jMM/jDD
    } else {
      setInputValue('');
    }
  }, [selectedDate]);

  const handleDaySelect: SelectSingleEventHandler = (date) => {
    onDateChange(date || null);
    setIsOpen(false);
    if(inputRef.current) inputRef.current.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const mDate = moment(inputValue, 'jYYYY/jMM/jDD', true); 
    if (mDate.isValid()) {
        if (!selectedDate || mDate.toDate().getTime() !== selectedDate.getTime()) {
            onDateChange(mDate.toDate());
        }
    } else if (inputValue === '') {
        if (selectedDate) onDateChange(null);
    } else {
        // Revert to last valid selectedDate if input is invalid and not empty
        if (selectedDate) {
            setInputValue(moment(selectedDate).locale('fa').format('jYYYY/jMM/jDD')); // Use jYYYY/jMM/jDD
        } else {
            setInputValue('');
        }
    }
    // Delay closing to allow click on picker
    setTimeout(() => {
        if (pickerRef.current && inputRef.current && 
            !pickerRef.current.contains(document.activeElement) && 
            document.activeElement !== inputRef.current) {
             setIsOpen(false);
        }
    }, 150);
  };

  const handleInputFocus = () => {
    if (!disabled) setIsOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node) && inputRef.current !== event.target) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const defaultMonthGregorian = selectedDate ? moment(selectedDate).toDate() : moment().toDate();

  const dayPickerClassNames: ClassNames = {
    caption_label: "text-sm font-medium text-indigo-700",
    button_previous: "absolute right-1.5 top-1.5 text-indigo-600 hover:text-indigo-800", 
    button_next: "absolute left-1.5 top-1.5 text-indigo-600 hover:text-indigo-800", 
    head_cell: "text-xs font-medium text-gray-500 w-9 text-center", 
    cell: "text-center",
    day: "h-9 w-9 p-0 text-sm hover:bg-indigo-100 rounded-md transition-colors",
    day_today: "font-bold text-indigo-600",
    day_selected: "bg-indigo-600 text-white hover:bg-indigo-700 focus:bg-indigo-700 rounded-md",
    day_outside: "text-gray-400 opacity-75",
    // caption_dropdowns: "flex justify-center items-center space-x-1 space-x-reverse", // No longer used with "buttons"
    // dropdown: "rdp-dropdown bg-white border border-gray-300 rounded text-sm py-1 px-2 mx-0.5", // No longer used
    // dropdown_icon: "hidden", // No longer used
    // dropdown_month: "rdp-dropdown_month mx-0.5", // No longer used
    // dropdown_year: "rdp-dropdown_year mx-0.5", // No longer used
    months: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4",
    month: "space-y-4",
    table: "w-full border-collapse",
    head_row: "flex",
    row: "flex w-full mt-2",
    day_disabled: "text-gray-300 cursor-not-allowed",
    nav_button: "h-6 w-6 flex items-center justify-center p-1 rounded-md hover:bg-gray-100",
  };

  return (
    <div className="relative" ref={pickerRef}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        className={inputClassName}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholderText}
        dir="rtl" 
        disabled={disabled}
        autoComplete="off"
      />
      {isOpen && !disabled && (
        <div
          className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg"
          style={document.dir === 'rtl' ? { right: 0, top: '100%' } : { left: 0, top: '100%' }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate || undefined} 
            onSelect={handleDaySelect}
            locale={shamsiFnsLocale} 
            formatters={shamsiFormatters}
            dir="rtl" 
            showOutsideDays
            initialFocus={isOpen} 
            defaultMonth={defaultMonthGregorian} 
            captionLayout={"buttons" as DayPickerProps['captionLayout']} // Changed from "dropdown"
            fromYear={moment().year() - 80} // Gregorian year for DayPicker navigation limits
            toYear={moment().year() + 15}    // Gregorian year for DayPicker navigation limits
            classNames={dayPickerClassNames}
          />
        </div>
      )}
    </div>
  );
};

export default ShamsiDatePicker;
