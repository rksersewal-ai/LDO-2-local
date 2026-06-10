import { z } from "zod";

const StringishSchema = z.union([z.string(), z.number()]).transform(String);
const StringArraySchema = z.array(StringishSchema);
const BooleanLikeSchema = z.union([z.boolean(), z.number(), z.string()]).transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
});

export const ApiSearchResultBaseSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string().nullish(),
    title: z.string().nullish(),
    status: z.string().nullish(),
    description: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    date: z.string().nullish(),
  })
  .passthrough();

export const ApiDocumentSchema = ApiSearchResultBaseSchema.extend({
  extracted_text: z.string().nullish(),
  duplicate_status: z.string().nullish(),
  duplicate_group_key: z.string().nullish(),
  linked_pl: z.string().nullish(),
  match_reasons: z.array(z.string()).nullish(),
  matched_assertions: z.array(z.any()).nullish(),
  matched_entities: z.array(z.any()).nullish(),
  file_hash: z.string().nullish(),
  fingerprint_3x64k: z.boolean().nullish(),
}).passthrough();

export type ApiDocument = z.infer<typeof ApiDocumentSchema>;

const ApiEngineeringChangeSchema = z
  .object({
    id: StringishSchema,
    ecNumber: z.string(),
    status: z.enum(["OPEN", "IN_REVIEW", "IMPLEMENTED", "RELEASED"]),
    description: z.string(),
    date: z.string(),
    author: z
      .string()
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .passthrough();

export const ApiPLItemSchema = ApiSearchResultBaseSchema.extend({
  part_number: z.string().nullish(),
  last_updated: z.string().nullish(),
  category: z.string().nullish(),
  controlling_agency: z.string().nullish(),
  safety_critical: BooleanLikeSchema.nullish(),
  safety_classification: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullish(),
  severity_of_failure: z.string().nullish(),
  consequences: z.string().nullish(),
  functionality: z.string().nullish(),
  application_area: z.string().nullish(),
  used_in: StringArraySchema.nullish(),
  drawing_numbers: StringArraySchema.nullish(),
  spec_numbers: StringArraySchema.nullish(),
  mother_part: z.string().nullish(),
  uvam_item_id: StringishSchema.nullish(),
  str_number: z.string().nullish(),
  eligibility_criteria: z.string().nullish(),
  procurement_conditions: z.string().nullish(),
  design_supervisor: z.string().nullish(),
  concerned_supervisor: z.string().nullish(),
  eoffice_file: z.string().nullish(),
  vendor_type: z.enum(["VD", "NVD"]).nullish(),
  recent_activity: StringArraySchema.nullish(),
  engineering_changes: z.array(ApiEngineeringChangeSchema).nullish(),
  linked_document_ids: StringArraySchema.nullish(),
  linked_work_ids: StringArraySchema.nullish(),
  linked_case_ids: StringArraySchema.nullish(),
}).passthrough();

export type ApiPLItem = z.infer<typeof ApiPLItemSchema>;

export const ApiWorkRecordSchema = ApiSearchResultBaseSchema.extend({
  eoffice_number: z.string().nullish(),
  remarks: z.string().nullish(),
}).passthrough();

export type ApiWorkRecord = z.infer<typeof ApiWorkRecordSchema>;

export const ApiCaseRecordSchema = ApiSearchResultBaseSchema.extend({
  pl_reference: z.string().nullish(),
  resolution: z.string().nullish(),
  opened_at: z.string().nullish(),
  closed_at: z.string().nullish(),
}).passthrough();

export type ApiCaseRecord = z.infer<typeof ApiCaseRecordSchema>;

export const ApiDocumentChangeAlertSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    status: z.string().nullish(),
    pl_item: z.union([z.string(), z.number()]).nullish(),
    pl_number: z.union([z.string(), z.number()]).nullish(),
    pl_name: z.string().nullish(),
    design_supervisor: z.string().nullish(),
    latest_document_id: z.union([z.string(), z.number()]).nullish(),
    latest_document: z.union([z.string(), z.number()]).nullish(),
    latest_document_name: z.string().nullish(),
    latest_document_status: z.string().nullish(),
    latest_document_type: z.string().nullish(),
    latest_revision: z.union([z.string(), z.number()]).nullish(),
    previous_document_id: z.union([z.string(), z.number()]).nullish(),
    previous_document_name: z.string().nullish(),
    previous_document_status: z.string().nullish(),
    previous_document_type: z.string().nullish(),
    previous_revision: z.union([z.string(), z.number()]).nullish(),
    document_family_key: z.string().nullish(),
    created_at: z.string().nullish(),
    change_summary: z.string().nullish(),
    resolution_notes: z.string().nullish(),
    bypass_reason: z.string().nullish(),
    resolved_at: z.string().nullish(),
  })
  .passthrough();

export type ApiDocumentChangeAlert = z.infer<typeof ApiDocumentChangeAlertSchema>;
