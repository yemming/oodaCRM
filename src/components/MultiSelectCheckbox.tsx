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

    const triggerLabel =
        selectedValues.length === 0
            ? placeholder
            : selectedValues.length === options.length
                ? 'All Selected'
                : `${selectedValues.length} selected`;

    return (
        <div className="jira-ms" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="jira-ms-trigger"
            >
                <span className="jira-ms-trigger-label">{triggerLabel}</span>
                <svg
                    className="jira-ms-chevron"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div className="jira-ms-menu">
                    <div
                        className={`jira-ms-item jira-ms-item-all ${allSelected ? 'is-selected' : ''}`}
                        onClick={handleSelectAll}
                    >
                        <span className={`jira-ms-check ${allSelected ? 'is-on' : ''}`}>
                            {allSelected && (
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </span>
                        <span className="jira-ms-item-label">Select All</span>
                    </div>

                    {options.map((option) => {
                        const on = selectedValues.includes(option.value);
                        return (
                            <div
                                key={option.value}
                                className={`jira-ms-item ${on ? 'is-selected' : ''}`}
                                onClick={() => toggleOption(option.value)}
                            >
                                <span className={`jira-ms-check ${on ? 'is-on' : ''}`}>
                                    {on && (
                                        <svg viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </span>
                                <span className="jira-ms-item-label">{option.label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
