// Minimal recursive Json type for generated DB types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// (Original generated types were removed because they contained an invalid placeholder)
