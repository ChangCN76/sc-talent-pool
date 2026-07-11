import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAuditLog(
  supabase: SupabaseClient,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  const { data: userData } = await supabase.auth.getUser();
  const actorEmail = userData.user?.email ?? "unknown-admin";

  await supabase.from("audit_log").insert({
    actor_email: actorEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}
