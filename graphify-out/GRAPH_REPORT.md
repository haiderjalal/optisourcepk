# Graph Report - optisourcepk  (2026-10-03)

## Corpus Check
- 248 files · ~178,253 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 1319 nodes · 3742 edges · 98 communities (55 shown, 43 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.83)
- Token cost: 117,508 input · 0 output

## Community Hubs (Navigation)
- Back-office pages & forms
- Public inquiry backend
- Quote request UI
- RX orders screen
- Paginated list pages
- Product catalogue
- Marketing site pages
- Customer management
- Database types
- Core schema (0001)
- Backup & logging
- Purchase invoices
- Invoice PDF rendering
- Order editing
- Product setup
- Invoice sharing & WhatsApp
- Site shell & SEO
- Order save & invoicing
- Stock receive & check
- Stock sheet layout
- Power grid
- TypeScript config
- Inquiry page & Next config
- Recently deleted
- Back-office navigation
- Dashboard & ledger
- Expenses
- Daily orders (0031)
- Package manifest
- Runtime dependencies
- Purchase schema (0013)
- WhatsApp webhook
- RX job card form
- Combined RX invoice (0025)
- Product detail page
- Stock service types
- Stock & purchase validation
- Dev dependencies
- Order builder
- Prescription stock (0003)
- Alerts & lens sign (0012)
- RX job card schema (0021)
- Purchases list
- Architecture docs: API
- Home page
- Stock availability check
- RX orders schema (0019)
- npm scripts
- RX ledger & daily stock (0027)
- Stock by entry (0004)
- Zero means none (0006)
- RX as order (0020)
- Recycle bin schema (0032)
- Root layout & styles
- Stock sheet PDF
- Friendly stock errors (0002)
- Invoice edit & delete (0026)
- Shared composite types
- Previous balance (0008)
- Low stock by ADD (0015)
- Low stock CYL+ADD (0017)
- Both-eyes stock (0018)
- Daily stock register (0029)
- Rendering & brand docs
- Prettier config
- Setup docs
- ESLint config
- Remove stock (0014)
- Expenses schema (0016)
- Receive powers (0010)
- Agent instructions
- Brand palette
- PostCSS config
- Health endpoint
- Accessibility doc
- SEO doc
- Brand voice
- Launch checklist
- Stack overview

## God Nodes (most connected - your core abstractions)
1. `requireUser` - 186 edges
2. `describePostgresError()` - 84 edges
3. `lucide-react` - 83 edges
4. `next` - 82 edges
5. `ButtonLink()` - 73 edges
6. `Button()` - 47 edges
7. `formatAmount()` - 44 edges
8. `react` - 37 edges
9. `cn()` - 35 edges
10. `Field()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `CustomerForm()` --indirect_call--> `saveCustomer()`  [INFERRED]
  src/features/shop/customers/CustomerForm.tsx → src/features/shop/customers/actions.ts
- `OrderBuilder()` --indirect_call--> `saveOrder()`  [INFERRED]
  src/features/shop/orders/OrderBuilder.tsx → src/features/shop/orders/actions.ts
- `RxOrderForm()` --indirect_call--> `saveOrder()`  [INFERRED]
  src/features/shop/rx/RxOrderForm.tsx → src/features/shop/orders/actions.ts
- `PowerGrid()` --indirect_call--> `todayInKarachi()`  [INFERRED]
  src/features/shop/products/PowerGrid.tsx → src/lib/format.ts
- `PurchaseForm()` --indirect_call--> `todayInKarachi()`  [INFERRED]
  src/features/shop/purchases/PurchaseForm.tsx → src/lib/format.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Inquiry submission flow** — docs_architecture_request_list, docs_api_post_api_inquiries, docs_architecture_validation, docs_architecture_inquiry_pipeline [INFERRED 0.85]

## Communities (98 total, 43 thin omitted)

### Community 0 - "Back-office pages & forms"
Cohesion: 0.06
Nodes (54): react-dom, metadata, NewCustomerPage(), AccountRows(), metadata, OrderPage(), Row(), RxDetail() (+46 more)

### Community 1 - "Public inquiry backend"
Cohesion: 0.05
Nodes (50): @supabase/ssr, @supabase/supabase-js, zod, dynamic, Body, POST(), LoginPage(), metadata (+42 more)

### Community 2 - "Quote request UI"
Cohesion: 0.07
Nodes (49): @hookform/resolvers, motion, react, react-hook-form, ErrorBoundary(), Button(), ButtonBaseProps, ButtonLinkProps (+41 more)

### Community 3 - "RX orders screen"
Cohesion: 0.07
Nodes (52): dioptre(), metadata, MONTH_NAME, rxNumber(), RxOrdersPage(), Stack(), STATUSES, costSchema (+44 more)

### Community 4 - "Paginated list pages"
Cohesion: 0.13
Nodes (35): CustomersPage(), metadata, ExpensesPage(), metadata, MONTH_NAME, shiftMonth(), InvoicesPage(), metadata (+27 more)

### Community 5 - "Product catalogue"
Cohesion: 0.11
Nodes (28): CategoryPage(), generateMetadata(), generateMetadata(), ProductPage(), CataloguePage(), metadata, STATIC_ROUTES, CatalogueBrowser() (+20 more)

### Community 6 - "Marketing site pages"
Cohesion: 0.13
Nodes (32): AboutPage(), metadata, VALUES, BulkSupplyPage(), LOGISTICS, metadata, SEGMENTS, TIERS (+24 more)

### Community 7 - "Customer management"
Cohesion: 0.13
Nodes (35): EditCustomerPage(), metadata, metadata, Stat(), StatementPage(), archiveCustomerAction(), readForm(), saveCustomer() (+27 more)

### Community 8 - "Database types"
Cohesion: 0.05
Nodes (38): BusinessTotalsRow, CustomerBalanceRow, CustomerRow, CustomerStatementRow, DailyStockEntryRow, Defaulted, Expense, ExpenseRow (+30 more)

### Community 9 - "Core schema (0001)"
Cohesion: 0.11
Nodes (34): customers_active_idx, customers_shop_area_uq, customers_touch, ledger_one_per_invoice, ledger_statement_idx, order_lines_freeze, order_lines_order_idx, order_lines_product_idx (+26 more)

### Community 10 - "Backup & logging"
Cohesion: 0.12
Nodes (21): server-only, GET(), saveSupplier(), Level, LogFields, logger, SupplierPayload, supplierSchema (+13 more)

### Community 11 - "Purchase invoices"
Cohesion: 0.11
Nodes (27): metadata, PurchasePage(), costSchema, CostState, PurchaseFormState, readLines(), savePurchase(), setPurchaseCostAction() (+19 more)

### Community 12 - "Invoice PDF rendering"
Cohesion: 0.13
Nodes (22): @react-pdf/renderer, GET(), GET(), COLUMNS, HeadCell(), InvoiceDocument(), Party(), Row() (+14 more)

### Community 13 - "Order editing"
Cohesion: 0.15
Nodes (22): EditOrderPage(), metadata, metadata, NewOrderPage(), metadata, NewPurchasePage(), metadata, NewRxOrderPage() (+14 more)

### Community 14 - "Product setup"
Cohesion: 0.13
Nodes (18): metadata, NewProductPage(), PowerGridState, ProductFormState, receivePowersAction(), saveProduct(), ProductForm(), SubmitButton() (+10 more)

### Community 15 - "Invoice sharing & WhatsApp"
Cohesion: 0.16
Nodes (21): InvoicePdfActions(), choose(), storageKey(), InvoiceWhatsAppButton(), sharePdf(), InvoiceWhatsAppButtonProps, RxWhatsAppButtons(), WhatsAppLink() (+13 more)

### Community 16 - "Site shell & SEO"
Cohesion: 0.19
Nodes (13): NotFound(), organisationSchema, SiteLayout(), Footer(), Header(), MobileMenu(), BRAND_STATEMENTS, CONTACT (+5 more)

### Community 17 - "Order save & invoicing"
Cohesion: 0.18
Nodes (19): readOrder(), saveOrder(), createDailyOrder(), createOrder(), DeliveryUpdate, discardOrder(), issueInvoice(), ListOrdersOptions (+11 more)

### Community 18 - "Stock receive & check"
Cohesion: 0.16
Nodes (16): StockCheck(), adjustStockAction(), StockFormState, Mode, norm(), QuickReceive(), Submit(), StockPanel() (+8 more)

### Community 19 - "Stock sheet layout"
Cohesion: 0.21
Nodes (14): StockSheetTable(), OrientedSheet, orientSheet(), Power, SheetLayout, SheetPages(), StockSheetPdfModel, styles (+6 more)

### Community 20 - "Power grid"
Cohesion: 0.30
Nodes (15): PowerGrid(), Submit(), buildSheet(), buildSheets(), cellKey(), noneIfZero(), toProductStock(), SwapLayoutButton() (+7 more)

### Community 21 - "TypeScript config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 22 - "Inquiry page & Next config"
Cohesion: 0.17
Nodes (11): nextConfig, next, metadata, InquiryPage(), metadata, STEPS, Crumb, FormSkeleton() (+3 more)

### Community 23 - "Recently deleted"
Cohesion: 0.22
Nodes (14): metadata, RecentlyDeletedPage(), restoreAction(), restoreSchema, RestoreState, RestoreButton(), Submit(), formatDateTime() (+6 more)

### Community 24 - "Back-office navigation"
Cohesion: 0.29
Nodes (9): lucide-react, ShopAppLayout(), CategoryGrid(), Logo(), LogoMark(), TiltCard(), NAV, ShopSidebar() (+1 more)

### Community 25 - "Dashboard & ledger"
Cohesion: 0.16
Nodes (15): Empty(), metadata, Metric(), ShopDashboardPage(), PaymentPayload, getBusinessTotals(), getLedgerTotals(), LedgerTotals (+7 more)

### Community 26 - "Expenses"
Cohesion: 0.22
Nodes (13): addExpenseAction(), deleteExpenseAction(), ExpenseFormState, ExpenseForm(), Submit(), COMMON_EXPENSES, ExpensePayload, expenseSchema (+5 more)

### Community 27 - "Daily orders (0031)"
Cohesion: 0.15
Nodes (6): daily_stock_postings_order_idx, orders_release_daily, public.daily_stock_postings, public.issue_invoice(), public.post_daily_outgoing(), public.reverse_daily_outgoing()

### Community 28 - "Package manifest"
Cohesion: 0.12
Nodes (15): name, private, version, babel-plugin-react-compiler, class-variance-authority, clsx, prettier, prettier-plugin-tailwindcss (+7 more)

### Community 29 - "Runtime dependencies"
Cohesion: 0.12
Nodes (16): dependencies, class-variance-authority, clsx, @hookform/resolvers, lucide-react, motion, next, react (+8 more)

### Community 30 - "Purchase schema (0013)"
Cohesion: 0.24
Nodes (13): public.purchase_invoice_lines, public.purchase_invoice_totals, public.purchase_invoices, public.record_purchase(), public.suppliers, purchase_invoice_lines_invoice_idx, purchase_invoice_lines_product_idx, purchase_invoices_date_idx (+5 more)

### Community 31 - "WhatsApp webhook"
Cohesion: 0.19
Nodes (10): GET(), InboundMessage, POST(), readEntries(), record(), BODY, isValidSignature(), safeEqual() (+2 more)

### Community 32 - "RX job card form"
Cohesion: 0.17
Nodes (13): OrderFormState, Choices(), EMPTY_EYE, EyeDraft, eyeFrom(), EyeKey, FITTING, FRAME_TYPES (+5 more)

### Community 33 - "Combined RX invoice (0025)"
Cohesion: 0.19
Nodes (5): orders_billed_in_idx, orders_release_rx, public.freeze_issued_order(), public.issue_invoice(), public.issue_rx_invoice()

### Community 34 - "Product detail page"
Cohesion: 0.31
Nodes (11): metadata, ProductPage(), RangeFillState, receiveRangeAction(), countBins(), RangeFillPanel(), Submit(), formatPower() (+3 more)

### Community 35 - "Stock service types"
Cohesion: 0.22
Nodes (12): ProductStock, ProductWithStock, AdjustStockInput, BinWithProduct, DailyStockLine, PowerEntry, receiveRange(), StockMovementLine (+4 more)

### Community 36 - "Stock & purchase validation"
Cohesion: 0.19
Nodes (11): power(), purchaseLineSchema, PurchasePayload, purchaseSchema, dailyQuantity, DailyStockPayload, dioptreField(), isQuarterStep() (+3 more)

### Community 37 - "Dev dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 38 - "Order builder"
Cohesion: 0.32
Nodes (11): emptyLine(), fromExisting(), LineDraft, lineTotal(), nextKey(), OrderBuilder(), addPair(), duplicate() (+3 more)

### Community 39 - "Prescription stock (0003)"
Cohesion: 0.22
Nodes (4): public.adjust_stock(), public.issue_invoice(), public.low_stock, public.set_bin_alert()

### Community 41 - "RX job card schema (0021)"
Cohesion: 0.20
Nodes (3): orders_number_rx, public.issue_invoice(), public.set_rx_stage()

### Community 42 - "Purchases list"
Cohesion: 0.38
Nodes (7): metadata, PurchasesPage(), metadata, SupplierPage(), PurchaseTable(), listPurchases(), getSupplier()

### Community 43 - "Architecture docs: API"
Cohesion: 0.22
Nodes (5): POST /api/inquiries, Inquiry pipeline, Pricing and order quantities, The request list, Validation

### Community 44 - "Home page"
Cohesion: 0.36
Nodes (6): HomePage(), metadata, Hero(), PROOF, StatementMarquee(), HeroCanvas()

### Community 45 - "Stock availability check"
Cohesion: 0.31
Nodes (8): BinLevel, keyOf(), normalise(), OrderLineDemand, part(), Position, ProductStockFlags, resolveOrderStock()

### Community 47 - "npm scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, lint, start, typecheck

### Community 53 - "Root layout & styles"
Cohesion: 0.29
Nodes (4): inter, metadata, outfit, viewport

### Community 54 - "Stock sheet PDF"
Cohesion: 0.57
Nodes (5): GET(), renderStockSheetPdf(), stockSheetFileName(), StockSheetDocument(), getProductStock()

### Community 57 - "Shared composite types"
Cohesion: 0.40
Nodes (6): CustomerWithBalance, OrderWithLines, RxSameDayJob, Customer, Order, OrderLine

### Community 62 - "Daily stock register (0029)"
Cohesion: 0.47
Nodes (3): daily_stock_entries_date_idx, daily_stock_entries_touch, public.daily_stock_entries

### Community 63 - "Rendering & brand docs"
Cohesion: 0.40
Nodes (3): Logotype, Typography, OptiSource PK

### Community 64 - "Prettier config"
Cohesion: 0.40
Nodes (4): plugins, semi, singleQuote, trailingComma

### Community 65 - "Setup docs"
Cohesion: 0.50
Nodes (4): Back-office login, Run the migration, Supabase project setup, Environment

### Community 66 - "ESLint config"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 68 - "Expenses schema (0016)"
Cohesion: 0.83
Nodes (3): expenses_date_idx, expenses_touch, public.expenses

## Knowledge Gaps
- **272 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `plugins`, `eslintConfig` (+267 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 430 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Inquiry page & Next config` to `Back-office pages & forms`, `Public inquiry backend`, `Quote request UI`, `RX orders screen`, `Paginated list pages`, `Product catalogue`, `Marketing site pages`, `Customer management`, `Backup & logging`, `Purchase invoices`, `Invoice PDF rendering`, `Order editing`, `Product setup`, `Invoice sharing & WhatsApp`, `Site shell & SEO`, `Stock receive & check`, `Power grid`, `Recently deleted`, `Back-office navigation`, `Dashboard & ledger`, `Expenses`, `Package manifest`, `RX job card form`, `Product detail page`, `Order builder`, `Purchases list`, `Home page`, `Root layout & styles`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `requireUser` connect `Customer management` to `Back-office pages & forms`, `Public inquiry backend`, `RX orders screen`, `Paginated list pages`, `Backup & logging`, `Purchase invoices`, `Invoice PDF rendering`, `Order editing`, `Product setup`, `Order save & invoicing`, `Stock receive & check`, `Recently deleted`, `Back-office navigation`, `Dashboard & ledger`, `Expenses`, `Product detail page`, `Stock service types`, `Purchases list`, `Stock sheet PDF`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Back-office navigation` to `Back-office pages & forms`, `Public inquiry backend`, `Quote request UI`, `RX orders screen`, `Paginated list pages`, `Product catalogue`, `Marketing site pages`, `Customer management`, `Purchase invoices`, `Order editing`, `Product setup`, `Invoice sharing & WhatsApp`, `Site shell & SEO`, `Stock receive & check`, `Power grid`, `Inquiry page & Next config`, `Recently deleted`, `Dashboard & ledger`, `Expenses`, `Package manifest`, `RX job card form`, `Product detail page`, `Order builder`, `Purchases list`, `Home page`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _272 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Back-office pages & forms` be split into smaller, more focused modules?**
  _Cohesion score 0.05755693581780538 - nodes in this community are weakly interconnected._
- **Should `Public inquiry backend` be split into smaller, more focused modules?**
  _Cohesion score 0.054274084124830396 - nodes in this community are weakly interconnected._
- **Should `Quote request UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07139079851930195 - nodes in this community are weakly interconnected._