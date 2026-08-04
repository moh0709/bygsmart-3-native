# BygSmart 3.0 Native — Syncable vs Back-office classification

Machine-readable companion to the baseline. `treatment` legend:
- `full` — soft-delete (`deleted_at`) + trigger `updated_at` + `(updated_at,id)` cursor + `emit_tombstone`
- `full-derived-tombstone` — full treatment but deletion event derives from a **parent** tombstone (composite/non-`id` PK)
- `read-cache` — syncable-read only; writes are service-role/RPC; refreshed on a TTL cache
- `local-cursor` — private per-user device state; `updated_at` cursor, no tombstone
- `back-office` — network-required; no offline treatment
- `reference` — static, read-only, bundled offline

## SYNCABLE (28)

| table | domain | pk | treatment |
|---|---|---|---|
| profiles | identity | id | full |
| organizations | identity | id | full |
| organization_members | identity | id | full |
| org_module_entitlements | identity | (org_id,module_id) | read-cache (72h TTL) |
| projects | project graph | id | full |
| project_resources | project graph | id | full |
| resource_task_access | project graph | id | full |
| tasks | project graph | id | full |
| quick_task_access | project graph | id | full |
| task_check_ins | field | id | full |
| task_documentation | field | id | full |
| task_handovers | field | id | full |
| task_quality_controls | field | id | full |
| task_chat_messages | field | id | full |
| task_chat_reads | field | (task_id,user_id) | local-cursor |
| punch_list_layouts | field | id | full |
| punch_list_items | field | id | full |
| purchases | field | id | full |
| reminders | field | id | full |
| activity_log | field | id | full |
| time_entries | time | id | full |
| time_registrations | time | id | full |
| org_time_responsibles | time | (org_id,staff_user_id) | full-derived-tombstone |
| documents | documents | id | full |
| document_visibility | documents | (document_id,resource_id) | full-derived-tombstone |
| quotations | money (syncable-read) | id | full |
| quotation_line_items | money (syncable-read) | id | full |
| task_budget_rates | money (syncable-read) | task_id | full-derived-tombstone |

## BACK-OFFICE (24) — no offline treatment

| table | note |
|---|---|
| notifications | delivery webhook |
| notification_preferences | default-on prefs |
| push_subscriptions | web push |
| logs | app logs |
| user_connections | connection graph (network-required) |
| connection_invites | connection flow |
| connection_requests | connection flow |
| partner_negotiation_messages | resource_id path only (legacy invite path dropped) |
| member_terminations | audit, service-role writes |
| smtp_configs | admin, encrypted secrets |
| tool_access_configs | admin gating |
| module_access_configs | admin global module defaults |
| org_module_prefs | owner presentation prefs |
| org_storage_usage | metering |
| ai_provider_configs | admin, encrypted keys |
| ai_usage_log | metering |
| ai_handover_reports_log | audit |
| trial_codes | promo, admin |
| demo_access_requests | demo intake, service-role |
| project_budgets | append-only ledger |
| project_budget_categories | append-only ledger |
| project_budget_revisions | append-only ledger |
| project_budget_revision_categories | append-only ledger |

## REFERENCE (1)

| table | note |
|---|---|
| regulations | static BR18/SBI/DS + Danish FTS; read-only, bundled offline |

## SYNC INFRASTRUCTURE (2)

| table | note |
|---|---|
| sync_tombstones | central delete feed served by the pull RPC |
| sync_idempotency_keys | mutation-endpoint dedupe, TTL >= 14 days |

## OMITTED (legacy — deliberately NOT reborn)

companies · project_partners · partner_task_access · teams · team_seats ·
_legacy_task_offers_backup · profiles.team_id / team_role / company_id ·
projects.team[] JSONB · projects.company_id · organizations.source_team_id /
source_company_id · partner_negotiation_messages.partner_invite_id (legacy path)
