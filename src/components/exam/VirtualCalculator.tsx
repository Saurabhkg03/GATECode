import React from 'react';
import Draggable from 'react-draggable';
import { X } from 'lucide-react';

interface VirtualCalculatorProps {
    isOpen: boolean;
    onClose: () => void;
}

const VirtualCalculator: React.FC<VirtualCalculatorProps> = ({ isOpen, onClose }) => {
    const nodeRef = React.useRef(null);

    if (!isOpen) return null;

    return (
        <Draggable nodeRef={nodeRef} handle=".calculator-handle" bounds="body">
            <div ref={nodeRef} className="fixed top-20 left-20 z-50 bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-gray-200 dark:border-zinc-700 w-[350px] sm:w-[470px] overflow-hidden flex flex-col">
                {/* Header / Drag Handle */}
                <div className="calculator-handle bg-purple-600 dark:bg-purple-800 text-white p-2 flex justify-between items-center cursor-move select-none">
                    <span className="font-semibold text-sm">Scientific Calculator</span>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                        aria-label="Close Calculator"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Calculator Iframe */}
                <div className="bg-white h-[320px] w-full relative">
                    <iframe
                        src="/calculator/index.html"
                        title="GATE Virtual Calculator"
                        className="w-full h-full border-0"
                        scrolling="no"
                    />
                    {/* Overlay to ensure drag events don't get trapped in iframe header area if user misses handle */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-transparent pointer-events-none"></div>
                </div>
            </div>
        </Draggable>
    );
};

export default VirtualCalculator;
