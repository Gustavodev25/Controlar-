// Stub component - Import review functionality has been temporarily disabled
// This prevents import errors while the feature is being refactored

interface ImportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transactions: any[]) => void;
  transactions: any[];
  accountName?: string;
}

export function ImportReviewModal({
  isOpen,
  onClose,
  onConfirm,
  transactions,
  accountName
}: ImportReviewModalProps) {
  // Stub implementation - does nothing
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Importar Transações</h2>
        <p className="text-gray-600 mb-4">
          Esta funcionalidade está temporariamente desabilitada.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
