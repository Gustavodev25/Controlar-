import React from "react";
import { Link, Building, ShieldCheck } from "./Icons";
import { useToasts } from "./Toast";

interface BankConnectProps {
  userId: string | null;
  memberId?: string | null;
  onItemConnected?: (itemId: string) => void;
  onSyncComplete?: (imported: number) => void;
  isSidebar?: boolean;
  isOpen?: boolean;
  existingAccountsCount?: number;
  userPlan?: 'starter' | 'pro' | 'family';
}

// Placeholder component now that Klavi integration was removed.
export const BankConnect: React.FC<BankConnectProps> = ({ isSidebar = false, isOpen: isSidebarOpen = true }) => {
  const toast = useToasts();

  const handleClick = () => {
    toast.message({ text: "Integracao Open Finance desativada." });
  };

  if (isSidebar) {
    return (
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group text-gray-500 border border-gray-800 hover:bg-gray-900 hover:text-gray-200 ${!isSidebarOpen ? 'justify-center' : ''}`}
      >
        <span className="text-[#d97757] group-hover:text-[#e68e70] transition-colors">
          <Building size={20} />
        </span>
        {isSidebarOpen && (
          <span className="font-medium text-sm truncate animate-fade-in">
            Open Finance desativado
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg font-medium text-sm transition-all border border-gray-700 hover:bg-gray-700"
    >
      <Link size={16} />
      <span className="flex items-center gap-2">
        <ShieldCheck size={14} />
        Open Finance indisponivel
      </span>
    </button>
  );
};
