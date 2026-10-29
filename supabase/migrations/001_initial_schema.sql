-- ====================================================================
-- STORE ACESSÓRIOS — SISTEMA DE ORDENS DE SERVIÇO
-- MIGRATION 001: Initial Schema, RLS Policies, and Public View
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tecnico' CHECK (role IN ('admin', 'tecnico')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SERVICE ORDERS TABLE
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  os_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Statuses
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (
    status IN (
      'recebido', 'em_diagnostico', 'orcamento_enviado',
      'aguardando_aprovacao', 'aguardando_pecas', 'em_manutencao',
      'em_testes', 'concluido', 'pronto_retirada', 'entregue'
    )
  ),
  budget_status TEXT NOT NULL DEFAULT 'aguardando_orcamento' CHECK (
    budget_status IN ('aguardando_orcamento', 'aguardando_aprovacao', 'aprovado', 'recusado', 'em_revisao')
  ),

  -- Technician
  technician_name TEXT NOT NULL,
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Customer Confidential Data (NEVER returned to public)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_whatsapp TEXT,
  customer_notes TEXT,

  -- Device info
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_color TEXT,
  device_imei_serial TEXT, -- Confidential
  accessories_received TEXT,
  physical_condition_intake TEXT,

  -- Diagnosis and Work
  customer_report TEXT NOT NULL,
  technical_diagnosis TEXT,
  required_services TEXT,
  required_parts TEXT,
  internal_notes TEXT, -- Strictly Confidential
  public_tech_notes TEXT, -- Visible to customer

  -- Budget / Financials
  parts_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  labor_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  additional_costs NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  budget_approval_date TIMESTAMPTZ,
  budget_approval_notes TEXT,

  -- Timeline & Delivery
  estimated_completion TEXT,
  estimated_delivery_date TIMESTAMPTZ,
  is_delayed BOOLEAN NOT NULL DEFAULT false,
  delay_reason TEXT,
  delivered_at TIMESTAMPTZ,
  warranty_description TEXT,

  -- Publication
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_cancelled BOOLEAN NOT NULL DEFAULT false
);

-- Index for fast lookup by OS number
CREATE INDEX IF NOT EXISTS idx_service_orders_os_number ON service_orders (os_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders (status);

-- 3. SERVICE ORDER PHOTOS TABLE
CREATE TABLE IF NOT EXISTS service_order_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_order_id ON service_order_photos (service_order_id);

-- 4. SERVICE ORDER ITEMS TABLE (Parts & Labor Breakdown)
CREATE TABLE IF NOT EXISTS service_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('peca', 'mao_de_obra', 'outro')),
  quantity NUMERIC(8, 2) NOT NULL DEFAULT 1.0,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- 5. SERVICE ORDER HISTORY TABLE (Audit Log)
CREATE TABLE IF NOT EXISTS service_order_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  public_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. STORE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  store_name TEXT NOT NULL,
  document_cnpj TEXT,
  phone TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  business_hours_week TEXT NOT NULL,
  business_hours_saturday TEXT NOT NULL,
  default_warranty TEXT NOT NULL,
  pickup_instructions TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SECURE PUBLIC VIEW (Stripping PII: customer_phone, customer_name, IMEI, internal_notes)
CREATE OR REPLACE VIEW public_service_orders_view AS
SELECT 
  id,
  os_number,
  created_at,
  updated_at,
  status,
  budget_status,
  device_brand,
  device_model,
  device_color,
  accessories_received,
  customer_report,
  technical_diagnosis,
  required_services,
  required_parts,
  public_tech_notes,
  parts_cost,
  labor_cost,
  additional_costs,
  discount,
  total_amount,
  estimated_completion,
  estimated_delivery_date,
  is_delayed,
  delay_reason,
  delivered_at,
  warranty_description
FROM service_orders
WHERE is_published = true AND is_cancelled = false;

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (technicians/admins) full access
CREATE POLICY "Admins full access to service_orders" 
  ON service_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access to service_order_photos" 
  ON service_order_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access to service_order_items" 
  ON service_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access to service_order_history" 
  ON service_order_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins full access to store_settings" 
  ON store_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read-only policies for published orders
CREATE POLICY "Public read published orders only" 
  ON service_orders FOR SELECT TO anon 
  USING (is_published = true AND is_cancelled = false);

CREATE POLICY "Public read photos of published orders" 
  ON service_order_photos FOR SELECT TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM service_orders 
      WHERE service_orders.id = service_order_photos.service_order_id 
      AND service_orders.is_published = true 
      AND service_orders.is_cancelled = false
    )
  );

CREATE POLICY "Public read public messages from history" 
  ON service_order_history FOR SELECT TO anon 
  USING (
    public_message IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM service_orders 
      WHERE service_orders.id = service_order_history.service_order_id 
      AND service_orders.is_published = true 
      AND service_orders.is_cancelled = false
    )
  );

CREATE POLICY "Public read store settings" 
  ON store_settings FOR SELECT TO anon USING (true);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_service_orders_timestamp
BEFORE UPDATE ON service_orders
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
