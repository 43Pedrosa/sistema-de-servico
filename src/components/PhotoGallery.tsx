import React, { useState, useEffect, useRef } from 'react';
import { Camera, ChevronLeft, ChevronRight, X, ZoomIn, Calendar } from 'lucide-react';
import { PublicServiceOrderPhoto } from '../types';

const EMPTY_PHOTOS: PublicServiceOrderPhoto[] = [];

interface PhotoGalleryProps {
  photos: PublicServiceOrderPhoto[];
  title?: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos = EMPTY_PHOTOS,
  title = 'Registro Fotográfico do Aparelho',
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = selectedIndex !== null;

  // Keep keyboard focus inside the lightbox and return it to the selected thumbnail on close.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIndex(null);
      if (e.key === 'ArrowRight') {
        setSelectedIndex(prev => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowLeft') {
        setSelectedIndex(prev => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
      }
      if (e.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen, photos.length]);

  if (!photos || photos.length === 0) {
    return (
      <div className="py-2 text-left">
        <Camera className="mb-2 h-5 w-5 text-[var(--sa-text-muted)]" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Nenhuma foto anexada</h3>
        <p className="sa-muted mt-1 text-xs">
          O técnico ainda não anexou registros fotográficos a esta ordem de serviço.
        </p>
      </div>
    );
  }

  const currentPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[var(--sa-accent)]" aria-hidden="true" />
          <h3 className="text-base font-bold">{title}</h3>
        </div>
        <span className="sa-muted text-xs">
          {photos.length} {photos.length === 1 ? 'registro' : 'fotos registradas'}
        </span>
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <button
            key={photo.id || idx}
            type="button"
            onClick={event => {
              triggerRef.current = event.currentTarget;
              setSelectedIndex(idx);
            }}
            aria-label={`Abrir foto ${idx + 1}${photo.caption ? `: ${photo.caption}` : ''}`}
            className="sa-focus group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-[var(--sa-border)] bg-[var(--sa-surface-muted)] text-left transition-colors hover:border-[var(--sa-accent)]"
          >
            <img
              src={photo.url}
              alt={photo.caption || `Foto ${idx + 1}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />

            {/* Overlay on hover */}
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-2.5">
              <div className="flex items-center justify-between text-white mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6A00] bg-black/60 px-1.5 py-0.5 rounded">
                  Foto {idx + 1}
                </span>
                <ZoomIn className="w-4 h-4 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
              </div>
              {photo.caption && (
                <p className="text-[11px] text-zinc-200 font-medium line-clamp-2 leading-snug">
                  {photo.caption}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedIndex !== null && currentPhoto && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Foto ${selectedIndex + 1} de ${photos.length}`} onClick={() => setSelectedIndex(null)} className="sa-gallery-dialog fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 sm:p-6">
          {/* Close button */}
          <button
            ref={closeButtonRef}
            onClick={() => setSelectedIndex(null)}
            aria-label="Fechar foto ampliada"
            className="sa-gallery-control sa-focus absolute right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center"
            title="Fechar (Esc)"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Navigation Prev */}
          {photos.length > 1 && (
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedIndex(prev => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
              }}
              aria-label="Foto anterior"
              className="sa-gallery-control sa-focus absolute left-3 z-50 inline-flex h-10 w-10 items-center justify-center sm:left-6"
              title="Foto anterior"
            >
              <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            </button>
          )}

          {/* Navigation Next */}
          {photos.length > 1 && (
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedIndex(prev => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
              }}
              aria-label="Próxima foto"
              className="sa-gallery-control sa-focus absolute right-3 z-50 inline-flex h-10 w-10 items-center justify-center sm:right-6"
              title="Próxima foto"
            >
              <ChevronRight className="w-6 h-6" aria-hidden="true" />
            </button>
          )}

          {/* Image Container with caption & metadata */}
          <div
            className="max-w-4xl max-h-[90vh] flex flex-col items-center justify-center select-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative max-h-[75vh] overflow-hidden rounded-lg border border-[var(--sa-border)] bg-black">
              <img
                src={currentPhoto.url}
                alt={currentPhoto.caption || 'Foto ampliada'}
                className="max-h-[72vh] w-auto max-w-full object-contain mx-auto"
              />
            </div>

            {/* Caption & Counter bar */}
            <div className="sa-gallery-caption mt-3 w-full max-w-xl px-4 py-2.5 text-center">
              <div className="sa-muted mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--sa-accent)]">
                  Foto {selectedIndex + 1} de {photos.length}
                </span>
                {currentPhoto.created_at && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Calendar className="w-3 h-3" />
                    {new Date(currentPhoto.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <p id="photo-gallery-caption" className="text-sm font-medium text-[var(--sa-text)]">
                {currentPhoto.caption || 'Registro fotográfico em bancada técnica.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
