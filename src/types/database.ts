/**
 * Shape of the back-office database, mirroring
 * `supabase/migrations/0001_backoffice.sql`.
 *
 * Hand-written so the application can be type-safe before the Supabase project
 * exists. Once it does, regenerate with `generate_typescript_types` and diff
 * against this file — any difference is a real mismatch between the migration
 * and what was assumed here, which is worth knowing about.
 *
 * `numeric` columns arrive as JS numbers through PostgREST. Money is
 * numeric(12,2), well inside the safe integer range once scaled, so this is
 * exact for every realistic invoice value.
 */

export type OrderStatus = "created" | "dispatched" | "delivered" | "cancelled";
export type LedgerEntryType = "invoice" | "payment" | "adjustment";
export type PaymentMethod =
  "cash" | "bank_transfer" | "cheque" | "easypaisa" | "jazzcash" | "other";
export type StockReason =
  "purchase" | "sale" | "return" | "adjustment" | "void";
export type OrderPriority = "normal" | "urgent";

export type ProductCategory =
  | "lenses"
  | "frames"
  | "accessories"
  | "lab-supplies"
  | "frame-parts-tools"
  | "optometric"
  | "services";

export type Eye = "R" | "L";

type CustomerRow = {
  id: string;
  customer_name: string;
  shop_name: string;
  area: string;
  address: string;
  phone: string;
  phone_alt: string | null;
  ntn: string | null;
  strn: string | null;
  default_discount_pct: number;
  opening_balance: number;
  opening_balance_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  list_price: number;
  tracks_power: boolean;
  tracks_stock: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type StockBinRow = {
  id: string;
  product_id: string;
  tracks_power: boolean;
  sph: number | null;
  qty_on_hand: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
};

type StockMovementRow = {
  id: string;
  bin_id: string;
  delta: number;
  reason: StockReason;
  order_id: string | null;
  note: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_no: number;
  external_order_ref: string | null;
  priority: OrderPriority;
  bill_to_customer_id: string;
  order_by_name: string | null;
  deliver_to_name: string | null;
  deliver_to_address: string | null;
  deliver_to_area: string | null;
  deliver_to_phone: string | null;
  bill_to_name: string | null;
  bill_to_shop: string | null;
  bill_to_address: string | null;
  bill_to_phone: string | null;
  bill_to_ntn: string | null;
  bill_to_strn: string | null;
  courier_name: string | null;
  tracking_no: string | null;
  status: OrderStatus;
  dispatched_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  delivery_note: string | null;
  issued_at: string | null;
  invoice_no: number | null;
  order_qty: number | null;
  lens_qty: number | null;
  invoice_amount: number | null;
  discount_amount: number | null;
  freight_charge: number;
  net_amount: number | null;
  gst_rate: number;
  gst_amount: number | null;
  additional_tax_rate: number;
  additional_tax_amount: number | null;
  amount_incl_tax: number | null;
  voided_at: string | null;
  void_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OrderLineRow = {
  id: string;
  order_id: string;
  line_no: number;
  order_ref: string | null;
  product_id: string;
  product_name: string;
  unit: string;
  eye: Eye | null;
  sph: number | null;
  cyl: number | null;
  ax: number | null;
  add_power: number | null;
  unit_price: number;
  discount_pct: number;
  quantity: number;
  /** Generated column — never written. */
  line_gross: number;
  /** Generated column — never written. */
  line_discount: number;
  /** Generated column — never written. */
  line_total: number;
  created_at: string;
  updated_at: string;
};

type LedgerEntryRow = {
  id: string;
  customer_id: string;
  entry_date: string;
  entry_type: LedgerEntryType;
  amount: number;
  order_id: string | null;
  payment_method: PaymentMethod | null;
  reference: string | null;
  memo: string | null;
  created_at: string;
};

type CustomerStatementRow = {
  customer_id: string;
  entry_date: string;
  kind: string;
  entry_id: string | null;
  invoice_no: number | null;
  description: string;
  debit: number | null;
  credit: number | null;
  amount: number;
  running_balance: number;
};

type CustomerBalanceRow = {
  customer_id: string;
  customer_name: string;
  shop_name: string;
  area: string;
  phone: string;
  opening_balance: number;
  invoiced: number;
  paid: number;
  adjustments: number;
  balance: number;
};

type LowStockRow = {
  bin_id: string;
  product_id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  sph: number | null;
  qty_on_hand: number;
  reorder_level: number;
  shortfall: number;
};

/** Columns the database fills in for us, never supplied on insert. */
type Generated =
  | "id"
  | "created_at"
  | "updated_at"
  | "line_gross"
  | "line_discount"
  | "line_total";

/** NOT NULL columns that carry a database default, so an insert may omit them. */
type Defaulted =
  | "order_no"
  | "priority"
  | "status"
  | "freight_charge"
  | "gst_rate"
  | "additional_tax_rate"
  | "unit"
  | "discount_pct"
  | "entry_date"
  | "qty_on_hand"
  | "reorder_level"
  | "tracks_power"
  | "tracks_stock"
  | "list_price"
  | "default_discount_pct"
  | "opening_balance"
  | "opening_balance_date";

/** A nullable column can always be left out — omitting it means NULL. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/** `Extract` rather than `&` so the key union actually reduces. */
type OptionalOnInsert<T> =
  Extract<keyof T, Generated | Defaulted> | NullableKeys<T>;

type Insert<T> = Omit<T, OptionalOnInsert<T>> &
  Partial<Pick<T, OptionalOnInsert<T>>>;

type Table<Row> = {
  Row: Row;
  Insert: Insert<Row>;
  Update: Partial<Insert<Row>>;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      customers: Table<CustomerRow>;
      products: Table<ProductRow>;
      stock_bins: Table<StockBinRow>;
      stock_movements: Table<StockMovementRow>;
      orders: Table<OrderRow>;
      order_lines: Table<OrderLineRow>;
      ledger_entries: Table<LedgerEntryRow>;
      counters: Table<{ name: string; next_value: number }>;
    };
    Views: {
      customer_statement: View<CustomerStatementRow>;
      customer_balances: View<CustomerBalanceRow>;
      low_stock: View<LowStockRow>;
    };
    Functions: {
      adjust_stock: {
        Args: {
          p_product_id: string;
          p_sph: number | null;
          p_delta: number;
          p_reason?: StockReason;
          p_note?: string | null;
        };
        Returns: number;
      };
      issue_invoice: {
        Args: {
          p_order_id: string;
          p_freight?: number;
          p_gst_rate?: number;
          p_additional_tax_rate?: number;
        };
        Returns: OrderRow;
      };
      void_invoice: {
        Args: { p_order_id: string; p_reason: string };
        Returns: OrderRow;
      };
    };
    Enums: {
      order_status: OrderStatus;
      ledger_entry_type: LedgerEntryType;
      payment_method: PaymentMethod;
      stock_reason: StockReason;
      order_priority: OrderPriority;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Customer = CustomerRow;
export type Product = ProductRow;
export type StockBin = StockBinRow;
export type Order = OrderRow;
export type OrderLine = OrderLineRow;
export type LedgerEntry = LedgerEntryRow;
export type CustomerStatementLine = CustomerStatementRow;
export type CustomerBalance = CustomerBalanceRow;
export type LowStockLine = LowStockRow;
