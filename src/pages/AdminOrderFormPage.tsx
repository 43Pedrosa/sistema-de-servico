import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Plus,
  DollarSign,
  Camera,
  Calendar,
  Smartphone,
  Shield,
  Clock,
  Eye,
  Check,
} from 'lucide-react';
import {
  ServiceOrder,
  ServiceOrderStatus,
  BudgetStatus,
  ServiceOrderPhoto,
} from '../types';
import {
  fetchAllOrders,
  saveOrUpdateOrder,
  generateNextOSNumber,
  getAdminUser,
} from '../lib/storage';
import { DEFAULT_STORE_SETTINGS, STATUS_STEPS } from '../lib/constants';
import { CUSTOM_DEVICE_OPTION, DEVICE_BRANDS, DEVICE_CATALOG } from '../lib/device-catalog';
import { StatusBadge } from '../components/StatusBadge';

const FORM_STEPS = [
  { title: 'Dados do Cliente', description: 'Identificação e contato' },
  { title: 'Aparelho', description: 'Marca, modelo e defeitos' },
  { title: 'Orçamento', description: 'Valores, prazo e fotos' },
  { title: 'Finalização', description: 'Execução, conclusão e entrega' },
] as const;
const CUSTOMER_REPORT_REQUIRED_ERROR = 'Informe o relato de defeito inicial.';

const getCurrentFormStep = (savedStep: number, order?: Partial<ServiceOrder>) => {
  if (savedStep >= 8) return 4;
  const canEnterFinalization = order?.status === 'orcamento_aprovado' ||
    ['em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue'].includes(order?.status || '');
  if ((savedStep === 3 || savedStep === 4 || savedStep >= 6) && canEnterFinalization) return 3;
  if (savedStep >= 4) return 2;
  if (savedStep === 3) return order?.customer_report ? 2 : 1;
  if (savedStep >= 2) {
    return order?.device_brand && order.device_model && order.customer_report ? 2 : 1;
  }
  if (savedStep === 1 && order?.customer_name && order.customer_phone) return 1;
  return 0;
};

const toLocalDateTimeInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

const parseCurrencyInput = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '');
  const decimalSeparator = normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
  const numericValue = normalized.replace(/[.,]/g, separator =>
    separator === decimalSeparator ? '.' : ''
  );
  const amount = Number(numericValue);
  return Number.isFinite(amount) ? amount : 0;
};

const compressPhoto = async (file: File): Promise<string> => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    for (const maxDimension of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a imagem.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.68, 0.52]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            result => result ? resolve(result) : reject(new Error('Não foi possível comprimir a imagem.')),
            'image/webp',
            quality
          );
        });

        if (blob.size <= 350 * 1024 || (maxDimension === 800 && quality === 0.52)) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('Não foi possível preparar a imagem.'));
            reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem.'));
            reader.readAsDataURL(blob);
          });
        }
      }
    }

    throw new Error('Não foi possível comprimir a imagem.');
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export const AdminOrderFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const adminUser = getAdminUser();
  const isAuthenticated = Boolean(adminUser);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const saveInProgress = useRef(false);
  const lastPersistedUpdatedAt = useRef<string | undefined>(undefined);
  const errorMessageRef = useRef<HTMLDivElement>(null);
  const customerReportRef = useRef<HTMLTextAreaElement>(null);
  const [customerReportInvalid, setCustomerReportInvalid] = useState(false);

  useEffect(() => {
    if (errorMessage) {
      if (errorMessage === CUSTOMER_REPORT_REQUIRED_ERROR && activeStep === 1) {
        customerReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        customerReportRef.current?.focus({ preventScroll: true });
        return;
      }
      errorMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeStep, errorMessage]);

  // Form State
  const [osNumber, setOsNumber] = useState('');
  const [createdAt, setCreatedAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [status, setStatus] = useState<ServiceOrderStatus>('recebido');
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>('aguardando_orcamento');
  const [technicianName, setTechnicianName] = useState(adminUser?.name || '');

  // Customer Data (Confidential)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Device Data
  const [deviceBrand, setDeviceBrand] = useState('');
  const [customDeviceBrand, setCustomDeviceBrand] = useState('');
  const [isCustomDeviceBrand, setIsCustomDeviceBrand] = useState(false);
  const [deviceModel, setDeviceModel] = useState('');
  const [isCustomDeviceModel, setIsCustomDeviceModel] = useState(false);
  const [deviceColor, setDeviceColor] = useState('');
  const [isCustomDeviceColor, setIsCustomDeviceColor] = useState(false);
  const [deviceImei, setDeviceImei] = useState('');
  const [accessoriesReceived, setAccessoriesReceived] = useState('');
  const [physicalCondition, setPhysicalCondition] = useState('');

  // Defects & Tech Notes
  const [customerReport, setCustomerReport] = useState('');
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState('');
  const [requiredServices, setRequiredServices] = useState('');
  const [requiredParts, setRequiredParts] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [publicTechNotes, setPublicTechNotes] = useState('');

  // Financials
  const [partsCost, setPartsCost] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState('');
  const [discount, setDiscount] = useState('');

  // Deadlines & Warranty
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [warrantyDescription, setWarrantyDescription] = useState(
    DEFAULT_STORE_SETTINGS.default_warranty
  );

  // Publication
  const [isPublished, setIsPublished] = useState(false);
  const [isBudgetSent, setIsBudgetSent] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Load existing data if editing
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }

    let isCurrent = true;
    if (isEditing && id) {
      setLoading(true);
      fetchAllOrders()
        .then(orders => {
          if (!isCurrent) return;
          const found = orders.find(o => o.id === id);
          if (found) {
            const savedDeviceBrand = found.device_brand || '';
            const savedDeviceModel = found.device_model || '';
            setOsNumber(found.os_number);
            lastPersistedUpdatedAt.current = found.updated_at;
            setCreatedAt(toLocalDateTimeInput(new Date(found.created_at)));
            setStatus(found.status);
            setBudgetStatus(found.budget_status);
            setIsBudgetSent(
              found.is_published &&
              found.status === 'orcamento_enviado' &&
              found.budget_status === 'aguardando_aprovacao'
            );
            setTechnicianName(found.technician_name);
            setCustomerName(found.customer_name || '');
            setCustomerPhone(found.customer_phone || '');
            setCustomerWhatsapp(found.customer_whatsapp || '');
            setCustomerNotes(found.customer_notes || '');
            setDeviceBrand(savedDeviceBrand);
            setIsCustomDeviceBrand(Boolean(savedDeviceBrand && !DEVICE_CATALOG[savedDeviceBrand]));
            setCustomDeviceBrand(savedDeviceBrand && !DEVICE_CATALOG[savedDeviceBrand] ? savedDeviceBrand : '');
            setDeviceModel(savedDeviceModel);
            setIsCustomDeviceModel(Boolean(savedDeviceBrand && savedDeviceModel && !DEVICE_CATALOG[savedDeviceBrand]?.[savedDeviceModel]));
            setDeviceColor(found.device_color || '');
            setIsCustomDeviceColor(Boolean(
              found.device_color &&
              !DEVICE_CATALOG[savedDeviceBrand]?.[savedDeviceModel]?.includes(found.device_color)
            ));
            setDeviceImei(found.device_imei_serial || '');
            setAccessoriesReceived(found.accessories_received || '');
            setPhysicalCondition(found.physical_condition_intake || '');
            setCustomerReport(found.customer_report || '');
            setTechnicalDiagnosis(found.technical_diagnosis || '');
            setRequiredServices(found.required_services || '');
            setRequiredParts(found.required_parts || '');
            setInternalNotes(found.internal_notes || '');
            setPublicTechNotes(found.public_tech_notes || '');
            setPartsCost(found.parts_cost ? String(found.parts_cost) : '');
            setLaborCost(found.labor_cost ? String(found.labor_cost) : '');
            setAdditionalCosts(found.additional_costs ? String(found.additional_costs) : '');
            setDiscount(found.discount ? String(found.discount) : '');
            setEstimatedCompletion(found.estimated_completion || '');
            setIsDelayed(Boolean(found.is_delayed));
            setDelayReason(found.delay_reason || '');
            setWarrantyDescription(found.warranty_description || DEFAULT_STORE_SETTINGS.default_warranty);
            setIsPublished(found.is_published !== undefined ? found.is_published : true);
            setIsCancelled(Boolean(found.is_cancelled));
            setPhotos(found.photos || []);
            setActiveStep(Math.min(getCurrentFormStep(found.administrative_step ?? 0, found), FORM_STEPS.length - 1));
          } else {
            setErrorMessage('Ordem de serviço não encontrada.');
          }
        })
        .catch(error => {
          if (!isCurrent) return;
          console.error('Failed to load service order for editing', error);
          setErrorMessage('Não foi possível carregar os dados da ordem de serviço.');
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
    } else {
      // New OS defaults
      setLoading(true);
      fetchAllOrders()
        .then(orders => {
          if (isCurrent) setOsNumber(generateNextOSNumber(orders));
        })
        .catch(error => {
          if (!isCurrent) return;
          console.error('Failed to load service orders for the next number', error);
          setErrorMessage('Não foi possível carregar as ordens para gerar o próximo número.');
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
    }
    return () => { isCurrent = false; };
  }, [id, isEditing, isAuthenticated, navigate]);

  // Total calculation dynamically
  const calculatedTotal = Math.max(
    0,
    parseCurrencyInput(partsCost) +
      parseCurrencyInput(laborCost) +
      parseCurrencyInput(additionalCosts) -
      parseCurrencyInput(discount)
  );
  const hasBudgetValues = [partsCost, laborCost, additionalCosts, discount]
    .some(value => value.trim().length > 0);
  const budgetNeedsSending = activeStep === 2 && (
    budgetStatus === 'aguardando_aprovacao' ||
    (budgetStatus === 'aguardando_orcamento' && hasBudgetValues)
  );

  useEffect(() => {
    if (!isEditing || !id || activeStep !== 2 || !isPublished || budgetStatus !== 'aguardando_aprovacao') return;

    let isCurrent = true;
    const refreshApproval = async () => {
      try {
        const orders = await fetchAllOrders();
        if (!isCurrent) return;
        const latest = orders.find(order => order.id === id);
        if (!latest || latest.budget_status === budgetStatus) return;
        setBudgetStatus(latest.budget_status);
        setStatus(latest.status);
        setIsBudgetSent(false);
        lastPersistedUpdatedAt.current = latest.updated_at;
        setSuccessMessage(latest.budget_status === 'aprovado'
          ? 'Orçamento aprovado. A execução está liberada.'
          : latest.budget_status === 'recusado'
            ? 'Orçamento recusado. O técnico foi informado e a execução permanece bloqueada.'
            : 'O cliente respondeu ao orçamento. Confira o novo status antes de continuar.');
      } catch (error) {
        console.error('Failed to refresh budget approval status', error);
      }
    };

    const intervalId = window.setInterval(() => { void refreshApproval(); }, 8000);
    window.addEventListener('focus', refreshApproval);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshApproval);
    };
  }, [activeStep, budgetStatus, id, isEditing, isPublished]);

  const deviceModels = isCustomDeviceBrand ? [] : Object.keys(DEVICE_CATALOG[deviceBrand] || {});
  const deviceColors = isCustomDeviceBrand ? [] : DEVICE_CATALOG[deviceBrand]?.[deviceModel] || [];

  // Photo file input handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    input.value = '';

    const validFiles: File[] = [];
    let validationMessage: string | null = null;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        validationMessage = 'Por favor selecione apenas arquivos de imagem válidos.';
      } else if (file.size > 5 * 1024 * 1024) {
        validationMessage = 'Imagem muito grande (máximo 5MB por arquivo).';
      } else {
        validFiles.push(file);
      }
    });

    if (validationMessage) setErrorMessage(validationMessage);
    if (validFiles.length === 0) return;

    setErrorMessage(null);
    setUploadProgress(10);
    try {
      const newPhotosToAdd = await Promise.all(validFiles.map(async file => ({
        id: crypto.randomUUID(),
        service_order_id: id || 'temp',
        storage_path: `/uploads/${file.name}`,
        url: await compressPhoto(file),
        caption: file.name.replace(/\.[^/.]+$/, ''),
        display_order: 0,
        created_at: new Date().toISOString(),
      })));

      setPhotos(currentPhotos => [
        ...currentPhotos,
        ...newPhotosToAdd.map((photo, index) => ({
          ...photo,
          display_order: currentPhotos.length + index + 1,
        })),
      ]);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
    } catch (error) {
      console.error(error);
      setErrorMessage('Não foi possível carregar uma ou mais imagens. Tente novamente.');
      setUploadProgress(null);
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos(currentPhotos => currentPhotos.filter(photo => photo.id !== photoId));
  };

  const updatePhotoCaption = (photoId: string, caption: string) => {
    setPhotos(currentPhotos => currentPhotos.map(photo => (
      photo.id === photoId ? { ...photo, caption } : photo
    )));
  };

  const handleSave = async (
    publishedState?: boolean,
    stepSave = false,
    updates?: Partial<Pick<ServiceOrder, 'status' | 'is_cancelled' | 'budget_status'>>,
    advanceAfterStepSave = true
  ) => {
    if (saveInProgress.current) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (uploadProgress !== null) {
      setErrorMessage('Aguarde o carregamento das fotos terminar antes de salvar.');
      return;
    }

    if (!osNumber.trim()) {
      setErrorMessage('O número da OS é obrigatório.');
      return;
    }
    if ((!stepSave || activeStep === 0) && (!customerName.trim() || !customerPhone.trim())) {
      setErrorMessage('Informe o nome e o telefone do cliente.');
      return;
    }
    if ((!stepSave || activeStep === 1) && (!deviceModel.trim() || !(isCustomDeviceBrand ? customDeviceBrand.trim() : deviceBrand.trim()))) {
      setErrorMessage('Informe a marca e o modelo do aparelho.');
      return;
    }
    if ((!stepSave || activeStep === 1) && !customerReport.trim()) {
      setCustomerReportInvalid(true);
      setErrorMessage(CUSTOMER_REPORT_REQUIRED_ERROR);
      return;
    }

    setLoading(true);
    saveInProgress.current = true;

    const publishFlag = publishedState !== undefined
      ? publishedState
      : stepSave
        ? (isEditing ? isPublished : false)
        : isPublished;

    try {
      const orderPayload: Partial<ServiceOrder> & { os_number: string; expected_updated_at?: string } = {
        id: id || undefined,
        os_number: osNumber.trim(),
        expected_updated_at: lastPersistedUpdatedAt.current,
        ...(
          stepSave
            ? {
              administrative_step: advanceAfterStepSave
                ? Math.min(activeStep + 1, FORM_STEPS.length)
                : activeStep,
            }
            : activeStep === FORM_STEPS.length - 1 && !updates
              ? { administrative_step: FORM_STEPS.length }
              : {}
        ),
      };
      if (!isEditing) orderPayload.is_published = true;
      const deviceBrandValue = isCustomDeviceBrand ? customDeviceBrand.trim() : deviceBrand;
      switch (activeStep) {
        case 0:
          Object.assign(orderPayload, {
            created_at: new Date(createdAt).toISOString(),
            technician_name: technicianName,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_whatsapp: customerWhatsapp,
            customer_notes: customerNotes,
          });
          break;
        case 1:
          Object.assign(orderPayload, {
            device_brand: deviceBrandValue,
            device_model: deviceModel,
            device_color: deviceColor,
            device_imei_serial: deviceImei,
            accessories_received: accessoriesReceived,
            physical_condition_intake: physicalCondition,
            customer_report: customerReport,
            technical_diagnosis: technicalDiagnosis,
            required_services: requiredServices,
            required_parts: requiredParts,
            internal_notes: internalNotes,
            public_tech_notes: publicTechNotes,
          });
          break;
        case 2:
          orderPayload.photos = photos;
          Object.assign(orderPayload, {
            parts_cost: parseCurrencyInput(partsCost),
            labor_cost: parseCurrencyInput(laborCost),
            additional_costs: parseCurrencyInput(additionalCosts),
            discount: parseCurrencyInput(discount),
            total_amount: calculatedTotal,
            estimated_completion: estimatedCompletion,
            is_delayed: isDelayed,
            delay_reason: delayReason,
            warranty_description: warrantyDescription,
          });
          break;
        case 3:
          Object.assign(orderPayload, {
            is_published: publishFlag,
            is_cancelled: updates?.is_cancelled ?? isCancelled,
            status,
          });
          break;
      }
      if (updates?.status !== undefined) orderPayload.status = updates.status;
      if (updates?.budget_status !== undefined) orderPayload.budget_status = updates.budget_status;
      if (updates?.is_cancelled !== undefined) orderPayload.is_cancelled = updates.is_cancelled;
      if (publishedState !== undefined) orderPayload.is_published = publishedState;
      if (updates?.status === 'entregue') orderPayload.delivered_at = new Date().toISOString();

      const saved = await saveOrUpdateOrder(orderPayload);
      lastPersistedUpdatedAt.current = saved.updated_at;

      if (publishedState === true && !saved.is_published) {
        throw new Error('O orçamento foi salvo, mas a OS não foi liberada para consulta.');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (stepSave) {
        const budgetSent = activeStep === 2 && publishedState === true &&
          saved.status === 'orcamento_enviado' &&
          saved.budget_status === 'aguardando_aprovacao';
        setSuccessMessage(
          budgetSent
            ? `Orçamento enviado. O cliente poderá aprová-lo diretamente na página de consulta da OS #${saved.os_number}.`
            : `Etapa "${FORM_STEPS[activeStep].title}" salva com sucesso.`
        );
        setIsPublished(saved.is_published);
        setStatus(saved.status);
        setBudgetStatus(saved.budget_status);
        setIsBudgetSent(
          saved.is_published &&
          saved.status === 'orcamento_enviado' &&
          saved.budget_status === 'aguardando_aprovacao'
        );
        if (!id) {
          navigate(`/admin/os/edit/${saved.id}`, { replace: true });
        }
        setActiveStep(Math.min(saved.administrative_step, FORM_STEPS.length - 1));
      } else {
        setSuccessMessage(
          isEditing
            ? `Ordem de Serviço #${saved.os_number} atualizada com sucesso!`
            : `Ordem de Serviço #${saved.os_number} cadastrada com sucesso!`
        );
        setTimeout(() => navigate('/admin'), 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage('Erro ao salvar ordem de serviço: ' + msg);
    } finally {
      saveInProgress.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="sa-technician-order-form flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel</span>
        </Link>

        {isEditing && (
          <Link
            to={`/consultar/${osNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-emerald-400 hover:bg-zinc-800 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver como o Cliente Vê</span>
          </Link>
        )}
      </div>

      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          {isEditing ? `Editar Ordem de Serviço #${osNumber}` : 'Nova Ordem de Serviço'}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Preencha os campos divididos por seção para controle técnico e acompanhamento.
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-sm flex items-start gap-2.5 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="space-y-2">
            <p className="font-semibold">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          ref={errorMessageRef}
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-sm flex items-center gap-2.5 animate-in fade-in"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4" aria-label="Etapas da ordem de serviço">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">
              Etapa {activeStep + 1} de {FORM_STEPS.length}: {FORM_STEPS[activeStep].title}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{FORM_STEPS[activeStep].description}</p>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {Math.round(((activeStep + 1) / FORM_STEPS.length) * 100)}%
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={FORM_STEPS.length}
          aria-valuenow={activeStep + 1}
          aria-label="Progresso do cadastro"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${((activeStep + 1) / FORM_STEPS.length) * 100}%`,
              backgroundImage: 'linear-gradient(to right, #ef4444 0%, #f97316 38%, #eab308 70%, #22c55e 100%)',
              backgroundSize: `${(FORM_STEPS.length / (activeStep + 1)) * 100}% 100%`,
            }}
          />
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORM_STEPS.map((step, index) => (
            <li key={step.title}>
              <button
                type="button"
                disabled={index > activeStep || loading}
                onClick={() => {
                  if (index <= activeStep) setActiveStep(index);
                }}
                aria-current={index === activeStep ? 'step' : undefined}
                className={`w-full rounded-lg border px-2 py-2 text-left text-[10px] transition sm:text-xs ${
                  index === activeStep
                    ? 'border-zinc-400 bg-zinc-800 text-white'
                    : index < activeStep
                      ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      : 'border-zinc-800 text-zinc-600'
                }`}
              >
                <span className="block font-mono">{index + 1}</span>
                <span className="block truncate">{step.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* FORM SECTIONS */}
      <div className="space-y-6">
        {/* ========================================================= */}
        {/* SECTION A: DADOS DA ORDEM */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 0} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
            <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
              A
            </div>
            <h3 className="text-base font-bold">Dados da Ordem</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Número da OS *
              </label>
              <input
                type="text"
                required
                value={osNumber}
                onChange={e => setOsNumber(e.target.value)}
                placeholder="Ex: 1687"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-sm focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Data / Hora de Abertura
              </label>
              <input
                type="datetime-local"
                value={createdAt}
                onChange={e => setCreatedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Técnico Responsável
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                placeholder="Nome do técnico"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION B: DADOS DO CLIENTE (CONFIDENCIAL) */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 0} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
                B
              </div>
              <h3 className="text-base font-bold">Dados do Cliente</h3>
            </div>
            <span className="text-[11px] text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              Confidencial (Oculto na consulta pública)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Nome Completo do Cliente *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Telefone Principal *
              </label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="(11) 98888-7777"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                WhatsApp (se diferente)
              </label>
              <input
                type="text"
                value={customerWhatsapp}
                onChange={e => setCustomerWhatsapp(e.target.value)}
                placeholder="(11) 98888-7777"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Observações do Cliente (Confidencial)
              </label>
              <input
                type="text"
                value={customerNotes}
                onChange={e => setCustomerNotes(e.target.value)}
                placeholder="Ex: Cliente tem viagem marcada; prefere contato após 14h."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION C: DADOS DO APARELHO */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 1} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
            <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
              C
            </div>
            <h3 className="text-base font-bold">Dados do Aparelho</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Marca *
              </label>
              <select
                required
                value={isCustomDeviceBrand ? CUSTOM_DEVICE_OPTION : deviceBrand}
                onChange={e => {
                  if (e.target.value === CUSTOM_DEVICE_OPTION) {
                    setIsCustomDeviceBrand(true);
                    setCustomDeviceBrand('');
                    setDeviceModel('');
                    setIsCustomDeviceModel(true);
                    setDeviceColor('');
                    setIsCustomDeviceColor(true);
                  } else {
                    setDeviceBrand(e.target.value);
                    setIsCustomDeviceBrand(false);
                    setCustomDeviceBrand('');
                    setDeviceModel('');
                    setIsCustomDeviceModel(false);
                    setDeviceColor('');
                    setIsCustomDeviceColor(false);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
              >
                <option value="" disabled>Selecione a marca</option>
                {DEVICE_BRANDS.filter(brand => brand !== 'Outro').map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
                <option value={CUSTOM_DEVICE_OPTION}>Outra marca (digitar)</option>
              </select>
              {isCustomDeviceBrand && (
                <input
                  type="text"
                  required
                  value={customDeviceBrand}
                  onChange={e => setCustomDeviceBrand(e.target.value)}
                  placeholder="Digite a marca"
                  aria-label="Digite a marca do aparelho"
                  className="mt-2 w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Modelo *
              </label>
              {deviceModels.length > 0 && !isCustomDeviceBrand ? (
                <>
                  <select
                    required
                    value={isCustomDeviceModel ? CUSTOM_DEVICE_OPTION : deviceModel}
                    onChange={e => {
                      if (e.target.value === CUSTOM_DEVICE_OPTION) {
                        setDeviceModel('');
                        setIsCustomDeviceModel(true);
                        setDeviceColor('');
                        setIsCustomDeviceColor(true);
                      } else {
                        setDeviceModel(e.target.value);
                        setIsCustomDeviceModel(false);
                        setDeviceColor('');
                        setIsCustomDeviceColor(false);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                  >
                    <option value="">Selecione o modelo</option>
                    {deviceModels.map(model => <option key={model} value={model}>{model}</option>)}
                    <option value={CUSTOM_DEVICE_OPTION}>Outro modelo (digitar)</option>
                  </select>
                  {isCustomDeviceModel && (
                    <input
                      type="text"
                      required
                      value={deviceModel}
                      onChange={e => setDeviceModel(e.target.value)}
                      placeholder="Digite o modelo"
                      aria-label="Digite o modelo do aparelho"
                      className="mt-2 w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  required
                  value={deviceModel}
                  onChange={e => setDeviceModel(e.target.value)}
                  placeholder="Digite o modelo"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Cor
              </label>
              {deviceColors.length > 0 && !isCustomDeviceColor ? (
                <>
                  <select
                    value={deviceColor}
                    onChange={e => {
                      if (e.target.value === CUSTOM_DEVICE_OPTION) {
                        setDeviceColor('');
                        setIsCustomDeviceColor(true);
                      } else {
                        setDeviceColor(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                  >
                    <option value="">Selecione a cor</option>
                    {deviceColors.map(color => <option key={color} value={color}>{color}</option>)}
                    <option value={CUSTOM_DEVICE_OPTION}>Outra cor (digitar)</option>
                  </select>
                  {isCustomDeviceColor && (
                    <input
                      type="text"
                      value={deviceColor}
                      onChange={e => setDeviceColor(e.target.value)}
                      placeholder="Digite a cor"
                      aria-label="Digite a cor do aparelho"
                      className="mt-2 w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={deviceColor}
                  onChange={e => setDeviceColor(e.target.value)}
                  placeholder="Digite a cor"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                IMEI / Nº de Série (Opcional/Privado)
              </label>
              <input
                type="text"
                value={deviceImei}
                onChange={e => setDeviceImei(e.target.value)}
                placeholder="356789123456789"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Acessórios Recebidos
              </label>
              <input
                type="text"
                value={accessoriesReceived}
                onChange={e => setAccessoriesReceived(e.target.value)}
                placeholder="Ex: Capinha de silicone, sem cartão SIM, película danificada."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Estado Físico na Entrada
              </label>
              <input
                type="text"
                value={physicalCondition}
                onChange={e => setPhysicalCondition(e.target.value)}
                placeholder="Ex: Trincado na quina superior, tampa traseira sem riscos."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:border-[#FF6A00]"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION D: DEFEITO E DIAGNÓSTICO */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 1} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
            <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
              D
            </div>
            <h3 className="text-base font-bold">Defeito e Diagnóstico</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Defeito Relatado pelo Cliente *
              </label>
              <textarea
                ref={customerReportRef}
                required
                rows={2}
                value={customerReport}
                onChange={e => {
                  setCustomerReport(e.target.value);
                  if (e.target.value.trim()) setCustomerReportInvalid(false);
                }}
                placeholder="Ex: Queda no chão, tela trincou e parou o touch."
                aria-invalid={customerReportInvalid}
                aria-describedby={customerReportInvalid ? 'customer-report-error' : undefined}
                className={`w-full px-3 py-2 rounded-xl bg-zinc-950 border text-white focus:outline-none focus:ring-1 ${
                  customerReportInvalid
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-zinc-700 focus:border-[#FF6A00] focus:ring-[#FF6A00]'
                }`}
              />
              {customerReportInvalid && (
                <p id="customer-report-error" className="mt-1.5 text-xs font-semibold text-red-400">
                  {CUSTOMER_REPORT_REQUIRED_ERROR}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Diagnóstico Técnico
                </label>
                <textarea
                  rows={3}
                  value={technicalDiagnosis}
                  onChange={e => {
                    setTechnicalDiagnosis(e.target.value);
                  }}
                  placeholder="Ex: Display OLED danificado com perda de sensibilidade do touch. Placa mãe em bom estado sem curto."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Serviços Necessários
                </label>
                <textarea
                  rows={3}
                  value={requiredServices}
                  onChange={e => {
                    setRequiredServices(e.target.value);
                  }}
                  placeholder="Ex: Substituição completa do display com reprogramação True Tone e vedação IP68."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Peças Necessárias
                </label>
                <input
                  type="text"
                  value={requiredParts}
                  onChange={e => {
                    setRequiredParts(e.target.value);
                  }}
                  placeholder="Ex: Display OLED Original + Guarnição de Vedação."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>

              <div>
                <label className="block font-semibold text-amber-300 mb-1">
                  Observações Destinadas ao Cliente (Públicas)
                </label>
                <input
                  type="text"
                  value={publicTechNotes}
                  onChange={e => {
                    setPublicTechNotes(e.target.value);
                  }}
                  placeholder="Ex: Peça instalada, em fase final de testes de bancada."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-red-400 mb-1">
                Observações Técnicas Internas (Estritamente Confidenciais — Nunca exibidas na página pública)
              </label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={e => {
                  setInternalNotes(e.target.value);
                }}
                placeholder="Ex: Selo de garantia aplicado no interior; bateria com saúde em 88%; cliente comentou que outro técnico já abriu."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-red-900/60 text-white focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION E: FOTOS */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 2} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
                E
              </div>
              <h3 className="text-base font-bold">Registro Fotográfico</h3>
            </div>
            <span className="text-xs text-zinc-400">
              {photos.length} {photos.length === 1 ? 'foto' : 'fotos'} adicionadas
            </span>
          </div>

          <div className="space-y-4">
            {/* Upload Box */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-[#FF6A00] rounded-2xl p-6 cursor-pointer bg-zinc-950/40 hover:bg-zinc-950/80 transition group">
              <Camera className="w-8 h-8 text-zinc-500 group-hover:text-[#FF6A00] mb-2 transition" />
              <p className="text-xs font-semibold text-zinc-200">
                Toque para tirar foto pelo celular ou selecionar do computador
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Formatos: JPG, PNG, WebP (até 5MB por arquivo)
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            {uploadProgress !== null && (
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#FF6A00] h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Photos Preview Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 space-y-2 relative group"
                  >
                    <div className="aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                      <img
                        src={photo.url}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={photo.caption || ''}
                        onChange={e => updatePhotoCaption(photo.id, e.target.value)}
                        placeholder={`Legenda da foto ${idx + 1}...`}
                        className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 focus:border-[#FF6A00]"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-900"
                        title="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION F: VALORES & ORÇAMENTO */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 2} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
            <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
              F
            </div>
            <h3 className="text-base font-bold">Valores e Orçamento</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Peças (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={partsCost}
                onChange={e => {
                  setPartsCost(e.target.value);
                  setIsBudgetSent(false);
                }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Mão de Obra (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={laborCost}
                onChange={e => {
                  setLaborCost(e.target.value);
                  setIsBudgetSent(false);
                }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Custos Adicionais (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={additionalCosts}
                onChange={e => {
                  setAdditionalCosts(e.target.value);
                  setIsBudgetSent(false);
                }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Desconto (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={discount}
                onChange={e => {
                  setDiscount(e.target.value);
                  setIsBudgetSent(false);
                }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Estado do Orçamento
              </label>
              <div className="flex min-h-[42px] items-center">
                <StatusBadge budgetStatus={budgetStatus} size="md" />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-zinc-300 mb-1">
                Previsão de Conclusão
              </label>
              <p className="mb-2 text-[11px] text-zinc-400">Informe ao cliente quando o aparelho deve ficar pronto.</p>
              <div className="relative">
                <input
                  type="text"
                  value={estimatedCompletion}
                  onChange={e => setEstimatedCompletion(e.target.value)}
                  placeholder="Ex: 30/10/2026 às 17h00"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 pr-11 text-white focus:border-[#FF6A00]"
                />
                <input
                  type="date"
                  aria-label="Escolher previsão de conclusão no calendário"
                  onChange={e => {
                    const [year, month, day] = e.target.value.split('-');
                    if (year && month && day) setEstimatedCompletion(`${day}/${month}/${year}`);
                    e.target.value = '';
                  }}
                  className="peer absolute right-0 top-0 h-full w-10 cursor-pointer"
                  style={{ opacity: 0 }}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#FF6A00]">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </div>
          </div>

          {/* Automatic Total Banner */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
              Total Calculado Automaticamente:
            </span>
            <span className="text-2xl font-black font-mono text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                calculatedTotal
              )}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION H: PUBLICAÇÃO E AÇÕES */}
        {/* ========================================================= */}
        <div hidden={activeStep !== 3} className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl space-y-5">
          <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
            <div className="w-6 h-6 rounded-lg bg-[#FF6A00] text-white flex items-center justify-center text-xs font-bold">
              H
            </div>
            <h3 className="text-base font-bold">Publicação e Finalização</h3>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-300" htmlFor="repair-status">Etapa da execução</label>
            <select
              id="repair-status"
              value={status}
              onChange={event => setStatus(event.target.value as ServiceOrderStatus)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-[#FF6A00]"
            >
              {!['em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue'].includes(status) && (
                <option value={status} disabled>{budgetStatus === 'recusado' ? 'Orçamento recusado' : STATUS_STEPS[status].shortLabel}</option>
              )}
              <option value="em_manutencao" disabled={budgetStatus !== 'aprovado'}>Em execução</option>
              <option value="em_testes" disabled={budgetStatus !== 'aprovado'}>Em testes</option>
              <option value="concluido" disabled={budgetStatus !== 'aprovado'}>Concluído</option>
              <option value="pronto_retirada" disabled={budgetStatus !== 'aprovado'}>Pronto para entrega</option>
              <option value="entregue" disabled={budgetStatus !== 'aprovado'}>Entregue</option>
              {budgetStatus === 'recusado' && <option value="em_diagnostico">Orçamento recusado</option>}
            </select>
            {budgetStatus !== 'aprovado' && <p className="mt-2 text-xs text-amber-300">A execução só é liberada após a aprovação do orçamento pelo cliente.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={isPublished}
                  onChange={e => setIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF6A00] bg-zinc-950 border-zinc-700"
                />
                <label htmlFor="isPublished" className="text-sm font-bold text-white cursor-pointer">
                  Publicar Acompanhamento Online
                </label>
              </div>
              <p className="text-xs text-zinc-400">
                Se desmarcado, fica salvo apenas como rascunho interno da bancada.
              </p>
            </div>

            {isEditing && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={budgetStatus !== 'aprovado'}
                  onClick={() => void handleSave(true, false, { status: 'entregue' })}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Marcar como Entregue
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja realmente cancelar esta Ordem de Serviço?')) {
                      void handleSave(false, false, { is_cancelled: true });
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-950 hover:bg-red-900 text-xs font-semibold text-red-300 border border-red-800 transition"
                >
                  Cancelar OS
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={loading || activeStep === 0}
          onClick={() => setActiveStep(currentStep => Math.max(currentStep - 1, 0))}
          className="step-back-button w-full rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Voltar
        </button>

        {budgetNeedsSending ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={loading || isBudgetSent}
              onClick={() => void handleSave(true, true, {
                status: 'orcamento_enviado',
                budget_status: 'aguardando_aprovacao',
              }, false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : (
                <>
                  {isBudgetSent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  <span>{isBudgetSent ? 'Enviado' : 'Enviar'}</span>
                </>
              )}
            </button>
          </div>
        ) : activeStep === 2 && budgetStatus === 'aprovado' ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSave(undefined, true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            <span>Ir para Finalização</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : activeStep === 2 ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSave(undefined, true, undefined, false)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Salvar</span>
              </>
            )}
          </button>
        ) : activeStep < FORM_STEPS.length - 1 ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSave(undefined, true)}
            aria-busy={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                <span>Salvando…</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Salvar e continuar</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSave(false)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              Salvar como rascunho
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSave(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEditing ? 'Atualizar e publicar OS' : 'Cadastrar e publicar OS'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
