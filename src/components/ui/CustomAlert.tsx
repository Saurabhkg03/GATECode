import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface CustomAlertProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    type?: AlertType;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
    isOpen,
    onClose,
    title,
    description,
    type = 'info',
    onConfirm,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="w-12 h-12 text-green-500" />;
            case 'error': return <XCircle className="w-12 h-12 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
            case 'confirm': return <AlertTriangle className="w-12 h-12 text-blue-500" />;
            default: return <Info className="w-12 h-12 text-blue-500" />;
        }
    };

    const getPrimaryButtonClass = () => {
        switch (type) {
            case 'error': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            case 'success': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
            case 'warning': return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
            default: return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={type !== 'error' ? onClose : undefined} // Force user to acknowledge error? Usually better to let them close.
            ></div>

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-sm w-full p-6 text-center border dark:border-zinc-800 transform transition-all scale-100">
                <div className="flex justify-center mb-4">
                    {getIcon()}
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {title}
                </h3>

                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                    {description}
                </p>

                <div className="flex gap-3 justify-center">
                    {(type === 'confirm' || onConfirm) && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                            {cancelText}
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${getPrimaryButtonClass()}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomAlert;
