import React from 'react';
import { Delete } from 'lucide-react';

interface VirtualNumpadProps {
    value: string;
    onChange: (val: string) => void;
}

const VirtualNumpad: React.FC<VirtualNumpadProps> = ({ value, onChange }) => {
    const handlePress = (key: string) => {
        if (key === 'Clear') {
            onChange('');
            return;
        }

        if (key === 'Backspace') {
            onChange(value.slice(0, -1));
            return;
        }

        const nextValue = value + key;

        // We only allow one '-' at the start.
        if (key === '-' && value !== '') return;

        // We only allow one decimal point.
        if (key === '.' && value.includes('.')) return;

        if (/^-?\d*\.?\d*$/.test(nextValue)) {
            onChange(nextValue);
        }
    };

    const keys = [
        '7', '8', '9',
        '4', '5', '6',
        '1', '2', '3',
        '.', '0', '-',
    ];

    return (
        <div className="bg-gray-100 dark:bg-zinc-800 p-4 w-full h-full">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 h-full">
                {keys.map((key) => (
                    <button
                        key={key}
                        onClick={() => handlePress(key)}
                        className="py-4 bg-white dark:bg-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-600 rounded shadow-sm text-xl font-bold border border-gray-300 dark:border-zinc-600 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        {key}
                    </button>
                ))}
                <button
                    onClick={() => handlePress('Backspace')}
                    className="py-4 bg-blue-100/70 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 rounded shadow-sm flex items-center justify-center text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    <Delete className="w-6 h-6" />
                </button>
                <button
                    onClick={() => handlePress('Clear')}
                    className="col-span-2 py-4 bg-red-100/70 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded shadow-sm text-red-700 dark:text-red-300 font-bold tracking-wide border border-red-300 dark:border-red-700 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none uppercase"
                >
                    Clear
                </button>
            </div>
        </div>
    );
};

export default VirtualNumpad;
