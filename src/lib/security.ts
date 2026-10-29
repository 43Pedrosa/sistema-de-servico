import { ServiceOrder, ServiceOrderPublic } from '../types';

/**
 * Strips all personal, confidential, and internal information from the ServiceOrder
 * before sending or rendering it to the public customer view.
 */
export function sanitizeOrderForPublic(order: ServiceOrder): ServiceOrderPublic {
  return {
    id: order.id,
    os_number: order.os_number,
    created_at: order.created_at,
    updated_at: order.updated_at,
    status: order.status,
    budget_status: order.budget_status,
    
    // Device details (non-sensitive)
    device_brand: order.device_brand || '',
    device_model: order.device_model || '',
    device_color: order.device_color,
    accessories_received: order.accessories_received,

    // Public technical details
    customer_report: order.customer_report || '',
    technical_diagnosis: order.technical_diagnosis,
    required_services: order.required_services,
    required_parts: order.required_parts,
    public_tech_notes: order.public_tech_notes,

    // Financial totals
    parts_cost: order.parts_cost,
    labor_cost: order.labor_cost,
    additional_costs: order.additional_costs,
    discount: order.discount,
    total_amount: order.total_amount,

    // Timeline, warranty & deadlines
    estimated_completion: order.estimated_completion,
    estimated_delivery_date: order.estimated_delivery_date,
    is_delayed: order.is_delayed,
    delay_reason: order.delay_reason,
    delivered_at: order.delivered_at,
    warranty_description: order.warranty_description,

    // Photos
    photos: [...(order.photos || [])].sort((a, b) => a.display_order - b.display_order),

    // Filter audit trail to only include messages meant for public viewing
    history: (order.history || [])
      .filter(h => !!h.public_message || h.event_type === 'created' || h.event_type === 'status_change')
      .map(h => ({
        id: h.id,
        event_type: h.event_type,
        public_message: h.public_message,
        created_at: h.created_at,
      })),
  };
}

/**
 * Validates OS number format. Allowed: digits and optional prefix/suffix.
 */
export function isValidOSNumber(osNumber: string): boolean {
  if (!osNumber) return false;
  const clean = osNumber.trim();
  return clean.length >= 2 && clean.length <= 20 && /^[A-Za-z0-9\-_]+$/.test(clean);
}

// In-memory rate limiting tracker for public queries
const queryAttempts: Record<string, number[]> = {};

export function checkRateLimit(key: string = 'client_default', limit = 15, windowMs = 60000): boolean {
  const now = Date.now();
  if (!queryAttempts[key]) {
    queryAttempts[key] = [];
  }
  // Remove entries outside window
  queryAttempts[key] = queryAttempts[key].filter(timestamp => now - timestamp < windowMs);

  if (queryAttempts[key].length >= limit) {
    return false; // Rate limit exceeded
  }

  queryAttempts[key].push(now);
  return true;
}
