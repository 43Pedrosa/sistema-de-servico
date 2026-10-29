
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  AlertCircle,
  Camera,
  Clock3,
  Cpu,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  isValidOSNumber,
  checkRateLimit,
} from '../lib/security';

import {
  fetchPublicOrderByOSNumber,
} from '../lib/storage';

export const PublicSearchPage: React.FC = () => {
  const [osInput, setOsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSearch = async (
    e?: React.FormEvent,
    customVal?: string,
  ) => {
    e?.preventDefault();

    const query = (
      customVal !== undefined ? customVal : osInput
    ).trim();

    setErrorMessage(null);

    const showError = (message: string) => {
      setErrorMessage(message);

      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };

    if (!query) {
      showError('Digite o número da Ordem de Serviço.');
      return;
    }

    if (!isValidOSNumber(query)) {
      showError(
        'Formato de OS inválido. Confira o número no comprovante da loja.',
      );
      return;
    }

    if (!checkRateLimit('public_search', 20, 60000)) {
      showError(
        'Muitas tentativas em pouco tempo. Aguarde alguns instantes.',
      );
      return;
    }

    setLoading(true);

    try {
      const order = await fetchPublicOrderByOSNumber(query);

      if (!order) {
        showError(
          `A OS #${query} não foi encontrada. Confira o número ou fale com a loja.`,
        );
      } else if (!order.is_published) {
        showError(
          'Esta OS ainda não foi liberada para consulta. Tente novamente em breve.',
        );
      } else if (order.is_cancelled) {
        showError(
          'Esta OS foi cancelada. Entre em contato com a Store Acessórios.',
        );
      } else {
        navigate(`/consultar/${order.os_number}`);
      }
    } catch (error) {
      console.error('Public order search failed', error);
      showError(error instanceof Error
        ? error.message
        : 'Falha temporária ao consultar. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="sa-public-page sa-search-page flex flex-1 items-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="sa-search-layout mx-auto grid w-full max-w-[1200px] items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <figure
          className="sa-search-visual"
          role="img"
          aria-label="Três smartphones com iluminação de estúdio"
        />

        <div className="sa-search-content">
          <div className="sa-search-intro">
            <p className="sa-search-eyebrow">ACOMPANHE SEU</p>
            <h1 className="sa-search-title">
              Conserto<span className="sa-search-title__period" aria-hidden="true" />
            </h1>
          </div>

          <ul className="sa-search-benefits" aria-label="Informações disponíveis">
            <li>
              <Clock3 aria-hidden="true" />
              <span>Etapas e atualizações do reparo.</span>
            </li>
            <li>
              <Camera aria-hidden="true" />
              <span>Fotos do dispositivo.</span>
            </li>
            <li>
              <Cpu aria-hidden="true" />
              <span>Informações técnicas.</span>
            </li>
          </ul>

          <div className="sa-search-form-panel">
            <form
              onSubmit={(event) => void handleSearch(event)}
              className="sa-search-form"
              aria-busy={loading}
              role="search"
              aria-label="Consultar Ordem de Serviço"
              noValidate
            >
              <div>
                <label
                  htmlFor="os-input"
                  className="mb-2 block text-sm font-semibold"
                >
                  Número da Ordem de Serviço
                </label>

                <div className="sa-search-input-wrap">
                  <Search aria-hidden="true" />
                  <input
                    ref={inputRef}
                    id="os-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={osInput}
                    onChange={(event) => {
                      setOsInput(event.target.value);

                      if (errorMessage) {
                        setErrorMessage(null);
                      }
                    }}
                    placeholder="Ex: 12345678"
                    className="sa-input sa-focus sa-search-input"
                    autoComplete="off"
                    aria-describedby={errorMessage ? 'os-error' : 'os-helper'}
                    aria-invalid={Boolean(errorMessage)}
                  />
                </div>

                {!errorMessage && (
                  <p id="os-helper" className="sa-search-helper">
                    Encontre o número no comprovante de atendimento.
                  </p>
                )}
              </div>

              {errorMessage && (
                <div
                  id="os-error"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="sa-error sa-search-error flex items-start gap-2 rounded-lg p-3 text-sm"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="sa-primary-button sa-focus sa-search-submit"
              >
                {loading ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    <span>Consultando OS…</span>
                  </>
                ) : (
                  <>
                    <span>Consultar OS</span>
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
              <p className="sa-search-privacy">
                <ShieldCheck aria-hidden="true" />
                Consulta pública e segura. Não é necessário informar dados pessoais.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};