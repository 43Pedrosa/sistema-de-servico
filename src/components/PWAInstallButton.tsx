import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside installed standalone PWA, suppress
  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`sa-primary-button sa-focus gap-1.5 ${
          compact
            ? 'min-h-10 px-2.5 text-xs'
            : 'px-3 text-xs'
        }`}
        title="Instalar aplicativo Store Acessórios"
      >
        <Download className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden sm:inline' : ''}>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="sa-secondary-button sa-focus gap-1.5 min-h-10 px-2.5 text-xs"
          title="Instalar no iPhone"
        >
          <Download className="w-3.5 h-3.5 text-[#FF6A00]" />
          <span className={compact ? 'hidden sm:inline' : ''}>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl relative text-left">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#FF6A00] flex items-center justify-center text-white font-black text-xl ">
                  S
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Instalar no iPhone / iPad</h3>
                  <p className="text-xs text-zinc-400">Store Acessórios</p>
                </div>
              </div>

              <div className="space-y-3.5 text-sm text-zinc-300">
                <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                  <Share2 className="w-5 h-5 text-[#FF6A00] shrink-0 mt-0.5" />
                  <p className="text-xs">
                    1. No navegador Safari, toque no botão <strong>Compartilhar</strong> (ícone com quadrado e seta para cima no rodapé).
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/50">
                  <PlusSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs">
                    2. Role a lista para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#FF6A00] hover:bg-[#E94B00] py-2.5 text-sm font-semibold text-white transition "
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
