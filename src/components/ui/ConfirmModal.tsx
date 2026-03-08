import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'info' | 'warning';
    isLoading?: boolean;
}

export const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    isLoading = false
}: ConfirmModalProps) => {
    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />;
            case 'warning':
                return <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />;
            default:
                return <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />;
        }
    };

    const getConfirmButtonVariant = () => {
        switch (variant) {
            case 'danger':
                return 'primary'; // Assuming primary can be red or stylized as danger
            default:
                return 'primary';
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="lg"
        >
            <div className="text-center py-4">
                {getIcon()}
                <p className="text-slate-600 dark:text-slate-400">
                    {message}
                </p>
                <div className="mt-8 flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        className={`flex-1 ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700 active:bg-red-800' : ''}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Aguarde...' : confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
