import React, { useState, useRef, useEffect } from 'react';

interface Option {
    label: string;
    value: string;
}

interface MultiSelectCheckboxProps {
    options: Option[];
    selectedValues: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
}

export const MultiSelectCheckbox: React.FC<MultiSelectCheckboxProps> = ({
    options,
    selectedValues,
    onChange,
    placeholder = "Select options..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleOption = (value: string) => {
        const newSelected = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedValues.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map(opt => opt.value));
        }
    };

    const allSelected = options.length > 0 && selectedValues.length === options.length;

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex justify-between items-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-1 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-w-[140px]"
                >
                    <span className="truncate text-left">
                        {selectedValues.length === 0
                            ? placeholder
                            : selectedValues.length === options.length
                                ? "All Selected"
                                : `${selectedValues.length} selected`}
                    </span>
                    <svg className="-mr-1 ml-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="origin-top-left absolute left-[35px] mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="py-1 max-h-60 overflow-y-auto">
                        {/* Select All Option */}
                        <div
                            className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                            onClick={handleSelectAll}
                        >
                            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${allSelected ? 'bg-white border-blue-600' : 'bg-white border-gray-300'
                                }`}>
                                {allSelected && (
                                    <svg className="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <span className="ml-3 text-base text-gray-700 font-semibold selection:bg-none">
                                Select All
                            </span>
                        </div>

                        {/* Options List */}
                        {options.map((option) => (
                            <div
                                key={option.value}
                                className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => toggleOption(option.value)}
                            >
                                <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${selectedValues.includes(option.value) ? 'bg-white border-blue-600' : 'bg-white border-gray-300'
                                    }`}>
                                    {selectedValues.includes(option.value) && (
                                        <svg className="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <span className="ml-3 text-base text-gray-700 block truncate selection:bg-none">
                                    {option.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
