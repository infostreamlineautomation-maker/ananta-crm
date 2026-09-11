export type CustomFieldModule =
  | "order_item"
  | "quotation_item"
  | "costing_item"
  | "product"
  | "client"
  | "company"
  | "supplier"
  | "project";

export type CustomFieldType = "text" | "number" | "select" | "date" | "boolean";

export interface CustomFieldDefinition {
  id: number;
  module: CustomFieldModule;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[];
  default_value: string;
  is_required: boolean;
  show_in_table: boolean;
  show_in_print: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItemDetail {
  id?: number;
  product: number | "";
  product_name?: string;
  description: string;
  qty: string;
  rate: string;
  amount?: string;
  extra_data: Record<string, string>;
  sort_order?: number;
}

export interface OrderImage {
  id: number;
  order: number;
  image: string;
  caption?: string;
  uploaded_at: string;
}

export interface OrderDetail {
  id: number;
  order_no: string;
  date: string;
  client: number;
  client_name: string;
  company_name?: string | null;
  project?: number | null;
  project_name?: string | null;
  project_title?: string;
  supplier: number | null;
  supplier_name: string | null;
  delivery_time?: string;
  description: string;
  columns_config: QuotationColumn[];
  tax_percent: string;
  subtotal: string;
  tax_amount: string;
  grand_total: string;
  currency_code?: string;
  exchange_rate?: string;
  base_currency_code?: string;
  delivery_status: "pending" | "in_process" | "ready" | "delivered";
  payment_status: "pending" | "advance" | "partial" | "paid";
  paid_amount?: string;
  due_amount?: string;
  is_visible_to_staff: boolean;
  copied_from: number | null;
  created_by: number | null;
  created_by_name: string | null;
  items: OrderItemDetail[];
  images?: OrderImage[];
  created_at: string;
  updated_at: string;
}


export interface RolePermissionRow {
  id: number;
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  is_system: boolean;
  permissions: RolePermissionRow[];
}

export interface AppUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: number | null;
  role_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  date_joined: string;
}

export interface NotificationEntry {
  id: number;
  event_type: string;
  title: string;
  message: string;
  order: number | null;
  order_no: string | null;
  created_at: string;
  is_read: boolean;
  is_dismissed: boolean;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  primary_color: string;
  default_currency_code?: string;
  tagline?: string;
  whatsapp_number?: string;
  whatsapp_default_country_code?: string;
  whatsapp_order_template?: string;
  whatsapp_quote_template?: string;
  whatsapp_payment_template?: string;
}

export interface Country {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
}

export interface ExchangeRate {
  id: number;
  source_currency: string;
  target_currency: string;
  rate: string;
  market_rate: string;
  is_manual_override: boolean;
  last_synced_at: string;
}

export interface AppSettings {
  app_name: string;
  app_logo: string | null;
  name?: string;
  logo?: string | null;
  primary_color?: string;
  tagline?: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  default_currency_code: string;
  default_tax_percent: string;
  order_prefix?: string;
  quotation_prefix: string;
  quotation_intro: string;
  quotation_terms: string;
  quotation_signature_name: string;
  quotation_designation: string;
  quotation_contact_person: string;
  quotation_background_image: string | null;
  quotation_signature_image: string | null;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
  smtp_use_ssl?: boolean;
  smtp_from_email?: string;
  smtp_from_name?: string;
  notify_admin_email?: string;
  notify_on_new_order?: boolean;
  notify_on_order_delivered?: boolean;
  notify_on_quote_accepted?: boolean;
  notify_on_payment_received?: boolean;
  whatsapp_number?: string;
  whatsapp_default_country_code?: string;
  whatsapp_order_template?: string;
  whatsapp_quote_template?: string;
  whatsapp_payment_template?: string;
}

export interface CommunicationLog {
  id: number;
  channel: "email" | "whatsapp";
  recipient: string;
  subject: string;
  message: string;
  status: "sent" | "failed" | "logged";
  error_message?: string;
  sent_by: number | null;
  sent_by_name: string | null;
  client: number | null;
  client_name: string | null;
  order: number | null;
  order_no: string | null;
  quotation: number | null;
  quotation_no: string | null;
  created_at: string;
}

export interface QuotationColumn {
  key: string;
  label: string;
}

export interface QuotationItemDetail {
  id?: number;
  description: string;
  qty: string;
  rate: string;
  amount?: string;
  extra_data: Record<string, string>;
  sort_order?: number;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected";

export interface QuotationDetail {
  id: number;
  quotation_no: string;
  quotation_date: string;
  client: number | null;
  client_name: string | null;
  company_name?: string | null;
  client_address?: string | null;
  project: number | null;
  project_name: string | null;
  to_name: string;
  to_address: string;
  subject: string;
  intro_text: string;
  notes: string;
  footer_content: string;
  col_qty_label: string;
  col_rate_label: string;
  columns_config: QuotationColumn[];
  currency_code: string;
  status: QuotationStatus;
  subtotal: string;
  items: QuotationItemDetail[];
  is_deleted: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationSummary {
  id: number;
  quotation_no: string;
  quotation_date: string;
  client: number | null;
  client_name: string | null;
  company_name?: string | null;
  project: number | null;
  subject: string;
  status: QuotationStatus;
  currency_code: string;
  subtotal: string;
}

export interface CostingItemDetail {
  id?: number;
  supplier_rate: string;
  quantity: string;
  client_rate: string;
  profit?: string;
  extra_data: Record<string, string>;
}

export interface CostingDetail {
  id: number;
  costing_date: string;
  project: number | null;
  project_name: string | null;
  supplier: number | null;
  supplier_display: string | null;
  product: number | null;
  product_display: string | null;
  client: number | null;
  client_display: string | null;
  description: string;
  columns_config: QuotationColumn[];
  items: CostingItemDetail[];
  supplier_cost: string;
  client_revenue: string;
  profit: string;
  profit_percent: string;
  is_deleted: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderSummary {
  id: number;
  order_no: string;
  date: string;
  client: number;
  client_name: string;
  company_name?: string | null;
  project?: number | null;
  project_name?: string | null;
  project_title?: string;
  supplier: number | null;
  supplier_name: string | null;
  delivery_time?: string;
  grand_total: string;
  currency_code?: string;
  delivery_status: "pending" | "in_process" | "ready" | "delivered";
  payment_status: "pending" | "advance" | "partial" | "paid";
  paid_amount?: string;
  due_amount?: string;
  images?: OrderImage[];
}

export interface ProjectSummary {
  id: number;
  name: string;
  client: number;
  client_name: string;
  description: string;
  status: "active" | "on_hold" | "completed" | "cancelled";
  extra_data?: Record<string, any>;
  orders_count: number;
  quotations_count: number;
  costings_count: number;
  total_order_value: string | number;
}

export interface ReportSummary {
  total_orders: number;
  total_revenue: number;
  paid_revenue: number;
  pending_revenue: number;
  avg_order_value?: number;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  revenue: number;
  paid: number;
  orders_count: number;
}

export interface StatusBreakdownItem {
  status: string;
  label: string;
  count: number;
  amount: number;
  color: string;
}

export interface QuotationFunnel {
  total_quotations: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  conversion_rate: number;
}

export interface CostingOverview {
  total_costings: number;
  total_supplier_cost: number | string;
  total_client_revenue: number | string;
  total_profit: number | string;
  avg_margin_percent: number;
}

export interface TopProductMetric {
  name: string;
  qty: number;
  revenue: number;
  share_pct: number;
}

export interface TopClientMetric {
  name: string;
  revenue: number;
  order_count: number;
  share_pct: number;
}

export interface AnalyticsKPIs {
  total_revenue: number;
  paid_revenue: number;
  pending_revenue: number;
  total_orders: number;
  avg_order_value: number;
  active_clients: number;
  revenue_growth: number;
  orders_growth: number;
  prev_revenue: number;
  prev_orders: number;
}

export interface AnalyticsReport {
  date_from: string;
  date_to: string;
  base_currency_code?: string;
  kpis: AnalyticsKPIs;
  trend: TimeSeriesPoint[];
  payment_breakdown: StatusBreakdownItem[];
  delivery_breakdown: StatusBreakdownItem[];
  quotation_funnel: QuotationFunnel;
  costing_overview: CostingOverview;
  top_products: TopProductMetric[];
  top_clients: TopClientMetric[];
}

export interface Product {
  id: number;
  product_name: string;
  description: string;
  extra_data?: Record<string, any>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Country {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
}

export interface Company {
  id: number;
  company_name: string;
  contact_name: string;
  vat_id: string;
  reg_no: string;
  contact_email: string;
  contact_phone: string;
  company_phone: string;
  country: string | null;
  country_name: string | null;
  state: string;
  city: string;
  zip_code: string;
  address: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  remarks: string;
  logo: string | null;
  extra_data?: Record<string, any>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type ClientType = "A" | "B" | "C";

export interface ClientGroup {
  id: number;
  name: string;
  description: string;
  color?: string;
  clients: number[];
  clients_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  client_name: string;
  client_type: ClientType;
  company: number | null;
  company_name: string | null;
  phone: string;
  email: string;
  address: string;
  country: string | null;
  country_name: string | null;
  currency_code: string | null;
  group_ids?: number[];
  extra_data?: Record<string, any>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierContact {
  id: number;
  supplier: number;
  contact_name: string;
  contact_number: string;
  designation: string;
}

export interface SupplierProduct {
  id: number;
  supplier: number;
  product: number;
  product_name: string;
  product_description?: string;
  product_extra_data?: Record<string, any>;
}

export interface SupplierFile {
  id: number;
  supplier: number;
  file_type: "quotation" | "rate_card" | "brochure";
  file: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

export interface ActivityLogEntry {
  id: number;
  user: number | null;
  user_name: string | null;
  user_full_name?: string | null;
  module: string;
  object_id: string;
  action: string;
  details: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  event_type: "created" | "delivery_changed" | "payment_updated" | "amount_updated" | "updated" | "comm_email" | "comm_whatsapp" | string;
  title: string;
  description: string;
  user_name: string;
  created_at: string;
  source: "activity" | "communication";
}

export interface Supplier {
  id: number;
  supplier_name: string;
  company_name?: string;
  owner_name_contact?: string;
  contact: string;
  source: string;
  product_details?: string;
  address: string;
  email: string;
  website: string;
  remark: string;
  extra_data?: Record<string, any>;
  is_deleted: boolean;
  contacts: SupplierContact[];
  supplier_products: SupplierProduct[];
  files: SupplierFile[];
  created_at: string;
  updated_at: string;
}

