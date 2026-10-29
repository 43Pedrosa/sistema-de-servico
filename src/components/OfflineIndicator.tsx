import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/95 backdrop-blur-md px-4 py-3 text-xs font-semibold text-zinc-950 shadow-2xl border border-amber-400 animate-bounce">
      <WifiOff className="w-4 h-4 shrink-0" />
      <div>
        <p className="font-bold">Modo Offline Detectado</p>
        <p className="text-[11px] font-normal text-zinc-900">
          Você está navegando com dados em cache. Atualizações e consultas dependem de conexão ativa com a internet.
        </p>
      </div>
    </div>
  );
};
