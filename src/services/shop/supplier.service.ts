import "server-only";

import { requireUser } from "@/server/shop/dal";
import { logger } from "@/lib/logger";
import type { SupplierPayload } from "@/lib/validations/shop/supplier";
import type { Supplier } from "@/types/database";
import { describePostgresError } from "./errors";

/** Suppliers: who stock is bought from. */

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toRow(payload: SupplierPayload) {
  return {
    name: payload.name,
    phone: optional(payload.phone),
    city: optional(payload.city),
    address: optional(payload.address),
    notes: optional(payload.notes),
  };
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .is("deleted_at", null)
    .order("name");

  if (error) throw new Error(describePostgresError(error, "load suppliers"));
  return data ?? [];
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(describePostgresError(error, "load the supplier"));
  return data;
}

export async function createSupplier(
  payload: SupplierPayload,
): Promise<Supplier> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("suppliers")
    .insert(toRow(payload))
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the supplier"));

  logger.info("Supplier created", { supplierId: data.id });
  return data;
}

export async function updateSupplier(
  id: string,
  payload: SupplierPayload,
): Promise<Supplier> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("suppliers")
    .update(toRow(payload))
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) throw new Error(describePostgresError(error, "save the supplier"));

  logger.info("Supplier updated", { supplierId: id });
  return data;
}
