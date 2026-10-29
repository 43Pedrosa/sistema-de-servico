export type ServiceOrderStatus =
  | 'recebido'
  | 'em_diagnostico'
  | 'orcamento_enviado'
  | 'orcamento_aprovado'
  | 'em_manutencao'
  | 'em_testes'
  | 'concluido'
  | 'pronto_retirada'
  | 'entregue';

export type BudgetStatus =
  | 'aguardando_orcamento'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'recusado'
  | 'em_revisao';

export interface ServiceOrderPhoto {
  id: string;
  service_order_id: string;
  storage_path: string; // or base64/url
  url: string;
  caption?: string;
  display_order: number;
  created_at: string;
}

export interface PublicServiceOrderPhoto {
  id: string;
  service_order_id: string;
  url: string;
  caption?: string;
  display_order: number;
  created_at: string;
}

export interface ServiceOrderItem {
  id: string;
  service_order_id: string;
  description: string;
  item_type: 'peca' | 'mao_de_obra' | 'outro';
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ServiceOrderHistory {
  id: string;
  service_order_id: string;
  actor_name: string;
  event_type: 'status_change' | 'budget_change' | 'photo_added' | 'note_added' | 'created' | 'updated';
  previous_value?: string;
  new_value?: string;
  public_message?: string;
  created_at: string;
}

export interface ServiceOrder {
  id: string;
  os_number: string;
  created_at: string;
  updated_at: string;
  status: ServiceOrderStatus;
  budget_status: BudgetStatus;
  administrative_step: number;
  
  // Technician info
  technician_name: string;
  technician_id?: string;

  // Customer private data (Never exposed to public)
  customer_name: string | null;
  customer_phone: string | null;
  customer_whatsapp?: string;
  customer_notes?: string;

  // Device data
  device_brand: string | null;
  device_model: string | null;
  device_color?: string;
  device_imei_serial?: string; // Private
  accessories_received?: string;
  physical_condition_intake?: string;

  // Defects & technical diagnosis
  customer_report: string | null;
  technical_diagnosis?: string;
  required_services?: string;
  required_parts?: string;
  internal_notes?: string; // Strictly confidential
  public_tech_notes?: string; // Visible to customer

  // Financial values
  parts_cost: number;
  labor_cost: number;
  additional_costs: number;
  discount: number;
  total_amount: number;
  budget_approval_date?: string;
  budget_approval_notes?: string;

  // Deadlines & warranty
  estimated_completion?: string;
  estimated_delivery_date?: string;
  is_delayed?: boolean;
  delay_reason?: string;
  delivered_at?: string;
  warranty_description?: string;

  // Publication state
  is_published: boolean;
  is_cancelled: boolean;

  // Related collections
  photos: ServiceOrderPhoto[];
  items?: ServiceOrderItem[];
  history: ServiceOrderHistory[];
}

/**
 * Public Sanitized representation: Safe for customers to see without exposing PII.
 */
export interface ServiceOrderPublic {
  id: string;
  os_number: string;
  created_at: string;
  updated_at: string;
  status: ServiceOrderStatus;
  budget_status: BudgetStatus;
  
  // Device
  device_brand: string | null;
  device_model: string | null;
  device_color?: string | null;
  accessories_received?: string | null;
  
  // Complaints & Diagnostics
  customer_report: string | null;
  technical_diagnosis?: string | null;
  required_services?: string | null;
  required_parts?: string | null;
  public_tech_notes?: string | null;

  // Financial
  parts_cost: number;
  labor_cost: number;
  additional_costs: number;
  discount: number;
  total_amount: number;

  // Timeline & Warranty
  estimated_completion?: string | null;
  estimated_delivery_date?: string | null;
  is_delayed?: boolean;
  delay_reason?: string | null;
  delivered_at?: string | null;
  warranty_description?: string | null;
  
  // Photos & History (filtered public only)
  photos: PublicServiceOrderPhoto[];
  history: Array<{
    id: string;
    event_type: string;
    public_message?: string;
    created_at: string;
    previous_value?: string;
    new_value?: string;
  }>;
}

export interface StoreSettings {
  store_name: string;
  document_cnpj?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  business_hours_week: string;
  business_hours_saturday: string;
  default_warranty: string;
  pickup_instructions: string;
}

export interface AdminUser {
  id: string | null;
  username: string;
  name: string;
  role: 'admin' | 'tecnico';
}
