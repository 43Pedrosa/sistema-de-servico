import React from 'react';
import { MapPin, Clock, MessageCircle } from 'lucide-react';
import { getStoreSettings } from '../lib/storage';

export const Footer: React.FC = () => {
  const settings = getStoreSettings();
  const whatsappClean = (settings.whatsapp || '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(
    'Olá, Store Acessórios! Gostaria de informações sobre meu aparelho em manutenção.'
  )}`;
  const address = [settings.address, [settings.neighborhood, settings.city, settings.state].filter(Boolean).join(' — ')].filter(Boolean);

  return (
    <footer className="sa-footer mt-auto text-sm">
      <div className="sa-footer-details mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-5 gap-y-4 px-5 py-4 sm:px-8 md:grid-cols-3 md:gap-x-8">
        <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 md:col-span-1">
          <h2 className="text-xs font-semibold">Empresa</h2>
          {settings.document_cnpj && <p className="sa-muted text-[11px]">CNPJ: {settings.document_cnpj}</p>}
          {whatsappClean && <a className="sa-footer-contact inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />WhatsApp</a>}
        </div>

        {address.length > 0 && (
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sa-accent)]" aria-hidden="true" />
            <div>
              <h2 className="text-xs font-semibold leading-4">Localização</h2>
              <p className="sa-muted mt-0.5 text-[11px] leading-4">{address.map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{line}</React.Fragment>)}</p>
            </div>
          </div>
        )}

        {(settings.business_hours_week || settings.business_hours_saturday) && <div className="flex min-w-0 items-start gap-2">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sa-accent)]" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-semibold leading-4">Horário de funcionamento</h2>
            <p className="sa-muted mt-0.5 text-[11px] leading-4">{settings.business_hours_week && <>{settings.business_hours_week}<br /></>}{settings.business_hours_saturday}</p>
          </div>
        </div>}
      </div>

      <div className="border-t border-[var(--sa-border)]">
        <div className="sa-muted mx-auto w-full max-w-6xl px-5 py-2 text-center text-[10px] sm:px-8">
          <p>© {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
