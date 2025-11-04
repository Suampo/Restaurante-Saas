// src/components/ConfirmationModal.jsx
import { useEffect } from 'react';

const Icon = ({ name, className = "h-6 w-6" }) => {
  const icons = {
    warning: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />,
  };
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>{icons[name]}</svg>;
};

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = "Confirmar",
  confirmColor = "red", // 'red' o 'emerald'
}) {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;
  
  const colorClasses = {
    red: "bg-red-600 hover:bg-red-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-30 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="sm:flex sm:items-start">
          <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-${confirmColor}-100 sm:mx-0 sm:h-10 sm:w-10`}>
            <Icon name="warning" className={`h-6 w-6 text-${confirmColor}-600`} />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">{title}</h3>
            <div className="mt-2">
              <div className="text-sm text-gray-500">{children}</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-200 sm:w-auto"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors sm:w-auto ${colorClasses[confirmColor]}`}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}