import { z } from 'zod'

// --- Company Schemas ---
export const companySchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  document: z
    .string()
    .min(11, { message: 'Document must be valid (CPF/CNPJ)' })
    .transform(val => val.replace(/\D/g, '')), // Remove masks
  email: z.string().email().optional().or(z.literal('')),
  phone: z
    .string()
    .optional()
    .transform(val => val?.replace(/\D/g, '')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  zip: z
    .string()
    .optional()
    .transform(val => val?.replace(/\D/g, '')),
  active: z.boolean().default(true)
})

export const companyUpdateSchema = companySchema
  .partial()
  .omit({ document: true }) // Document is usually immutable

// --- User Schemas ---
export const userSchema = z.object({
  companyId: z.number().optional(), // Nullable/Optional
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  email: z.string().email('Invalid email address'),
  document: z
    .string()
    .min(11, { message: 'Document must be valid (CPF/CNPJ)' })
    .transform(val => val.replace(/\D/g, '')), // Remove masks
  phone: z
    .string()
    .optional()
    .transform(val => val?.replace(/\D/g, '')), // Remove masks
  role: z.enum(['admin', 'user', 'manager']).default('user'),
  active: z.boolean().default(true),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
  hwid: z.string().optional()
})

export const userUpdateSchema = userSchema
  .partial()
  .omit({ email: true, document: true, password: true, hwid: true })

export const userCompanySchema = z.object({
  userId: z.number({ required_error: 'userId is required' }),
  companyId: z.number({ required_error: 'companyId is required' }),
  role: z.enum(['admin', 'user', 'manager']).default('user')
})

export type UserCompanyInput = z.infer<typeof userCompanySchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  hwid: z.string().optional()
})

// --- Product Schemas ---
export const productSchema = z.object({
  companyId: z.number({
    required_error: 'Company ID is required and must be a number'
  }),
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().optional(),
  type: z
    .enum(['concrete', 'pump', 'additive', 'rental', 'other'])
    .default('other'),
  unit: z.enum(['m3', 'un', 'hr', 'kg', 'ton']).default('un'),
  price: z
    .number()
    .min(0, { message: 'Price must be non-negative' })
    .default(0), // Cents
  sku: z.string().optional(),
  fck: z.number().int().optional(), // MPa
  slump: z.number().int().optional(), // cm
  stoneSize: z.string().optional(), // e.g., "brita 0"
  active: z.boolean().default(true)
})

export const productUpdateSchema = productSchema
  .partial()
  .omit({ companyId: true }) // Company usually doesn't change

// --- Quote Schemas ---
export const quoteItemSchema = z.object({
  productId: z.number().optional(), // Can be null if custom item
  productName: z.string().min(1, { message: 'Product name is required' }),
  description: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number().min(0.1, { message: 'Quantity must be positive' }),
  unitPrice: z.number().min(0, { message: 'Price must be non-negative' }), // Cents
  // Specifics
  fck: z.number().optional(),
  slump: z.number().optional(),
  stoneSize: z.string().optional()
})

export const quoteSchema = z.object({
  companyId: z.number({
    required_error: 'Company ID is required and must be a number'
  }),
  userId: z.number().optional(),
  sellerId: z.number().optional(),

  customerName: z.string().min(3, { message: 'Customer Name is required' }),
  customerDocument: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),

  status: z
    .enum(['draft', 'sent', 'approved', 'rejected', 'expired'])
    .default('draft'),
  validUntil: z.string().datetime().optional().or(z.date()), // Accepts ISO string or Date object

  discount: z.number().min(0).default(0), // Cents
  notes: z.string().optional(),

  items: z
    .array(quoteItemSchema)
    .min(1, { message: 'Quote must have at least one item' })
})

export const quoteUpdateSchema = quoteSchema
  .partial()
  .omit({ companyId: true })

export type CompanyInput = z.infer<typeof companySchema>
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>
export type UserInput = z.infer<typeof userSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type ProductInput = z.infer<typeof productSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>

// --- Sale Schemas ---
export const saleItemSchema = z.object({
  productId: z.number().optional(), // Can be null if custom item
  productName: z.string().min(1, { message: 'Product name is required' }),
  description: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.number().min(0.1, { message: 'Quantity must be positive' }),
  unitPrice: z.number().min(0, { message: 'Price must be non-negative' }), // Cents
  // Specifics
  fck: z.number().optional(),
  slump: z.number().optional(),
  stoneSize: z.string().optional()
})

export const saleSchema = z.object({
  companyId: z.number({
    required_error: 'Company ID is required and must be a number'
  }),
  userId: z.number().optional(),
  quoteId: z.number().optional(),
  sellerId: z.number().optional(),

  customerName: z.string().min(3, { message: 'Customer Name is required' }),
  customerDocument: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),

  date: z.string().datetime().optional().or(z.date()),
  deliveryDate: z.string().datetime().optional().or(z.date()),
  status: z
    .enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
    .optional(),

  discount: z.number().min(0).default(0), // Cents
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),

  items: z
    .array(saleItemSchema)
    .min(1, { message: 'Sale must have at least one item' })
})

export const saleUpdateSchema = saleSchema.partial().omit({ companyId: true })

export type SaleInput = z.infer<typeof saleSchema>
export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>

// --- Payment Method Schemas ---
export const paymentMethodSchema = z.object({
  companyId: z.number({
    required_error: 'Company ID is required and must be a number'
  }),
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  type: z
    .enum([
      'cash',
      'credit_card',
      'debit_card',
      'pix',
      'boleto',
      'transfer',
      'check',
      'other'
    ])
    .default('other'),

  details: z.record(z.string(), z.any()).optional(), // Flexible JSON object

  active: z.boolean().default(true)
})

export const paymentMethodUpdateSchema = paymentMethodSchema
  .partial()
  .omit({ companyId: true })

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>
export type PaymentMethodUpdateInput = z.infer<
  typeof paymentMethodUpdateSchema
>

// --- Seller Schemas ---
export const sellerSchema = z.object({
  companyId: z.number({
    required_error: 'Company ID is required and must be a number'
  }),
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  document: z
    .string()
    .optional()
    .transform(val => val?.replace(/\D/g, '')), // Strip CPF mask
  email: z.string().email().optional().or(z.literal('')),
  phone: z
    .string()
    .optional()
    .transform(val => val?.replace(/\D/g, '')), // Strip phone mask
  commissionRate: z.number().min(0).max(100).default(0),
  active: z.boolean().default(true)
})

export const sellerUpdateSchema = sellerSchema
  .partial()
  .omit({ companyId: true })

export type SellerInput = z.infer<typeof sellerSchema>
export type SellerUpdateInput = z.infer<typeof sellerUpdateSchema>

// --- Transaction Schemas ---
export const transactionSchema = z.object({
  companyId: z.number({
    required_error: 'Company ID is required and must be a number'
  }),
  userId: z.number().optional(),
  saleId: z.number().optional(),

  description: z
    .string()
    .min(3, { message: 'Description must be at least 3 characters' }),
  amount: z
    .number()
    .min(0, { message: 'Amount must be a positive number (cents)' }),
  type: z.enum(['income', 'expense']),
  category: z.string().optional(),

  status: z.enum(['pending', 'paid', 'cancelled']).default('pending'),
  date: z.string().datetime().optional().or(z.date()),
  dueDate: z.string().datetime().optional().or(z.date()),

  paymentMethod: z.string().optional()
})

export const transactionUpdateSchema = transactionSchema
  .partial()
  .omit({ companyId: true })

export type TransactionInput = z.infer<typeof transactionSchema>
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

// --- WhatsApp Settings Schemas ---
export const whatsappSettingsSchema = z.object({
  companyId: z.number({ required_error: 'Company ID is required' }),
  apiUrl: z
    .string()
    .min(5, { message: 'API URL is too short' })
    .default('http://localhost:3025'),
  apiKey: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  alertsEnabled: z.boolean().default(false),
  reportsEnabled: z.boolean().default(false),
  alertRecipients: z.array(z.string()).default([]),
  reportRecipients: z.array(z.string()).default([]),
  reportSchedule: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  quotePdfToSeller: z.boolean().default(false),
  quotePdfToCustomer: z.boolean().default(false),
  schedulesReminderEnabled: z.boolean().default(false),
  schedulesReminderLeadTimeHours: z.number().int().min(1).default(24),
  schedulesReminderRecipients: z.array(z.string()).default([]),
  isGlobal: z.boolean().default(false)
})

export const whatsappSettingsUpdateSchema = whatsappSettingsSchema
  .partial()
  .omit({ companyId: true })

export type WhatsappSettingsInput = z.infer<typeof whatsappSettingsSchema>
export type WhatsappSettingsUpdateInput = z.infer<
  typeof whatsappSettingsUpdateSchema
>

// --- Schedule Schemas ---
export const scheduleSchema = z.object({
  companyId: z.number({ required_error: 'Company ID is required' }),
  userId: z.number({ required_error: 'User ID is required' }),
  saleId: z.number().optional().nullable(),
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
  description: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z
    .string()
    .optional()
    .nullable()
    .transform(val => val?.replace(/\D/g, '')),
  location: z.string().optional().nullable(),
  status: z
    .enum(['pending', 'confirmed', 'completed', 'cancelled'])
    .default('pending'),
  type: z
    .enum(['concrete_delivery', 'pump_service', 'site_visit', 'other'])
    .default('other'),
  date: z.string().datetime().or(z.date()),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)')
    .optional()
    .nullable(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)')
    .optional()
    .nullable()
})

export const scheduleUpdateSchema = scheduleSchema
  .partial()
  .omit({ companyId: true, userId: true })

export type ScheduleInput = z.infer<typeof scheduleSchema>
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>
