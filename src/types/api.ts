/** Every route handler in this app answers with this shape. */
export interface ApiResponse<TData = undefined> {
  success: boolean;
  message: string;
  data?: TData;
  /** Field-level validation problems, keyed by form field name. */
  errors?: Record<string, string[]>;
}
