-- Seed the demo tenant: Amanah Foundation (monthly food support charity).
-- Qualifies when: monthly income < 15000 BDT AND >=1 child under 18
--   AND lives in a target district AND has a national ID.
-- Idempotent: safe to run more than once.

do $$
declare
  v_tenant uuid;
  v_agent uuid;
begin
  -- Tenant
  select id into v_tenant from tenants where name = 'Amanah Foundation';
  if v_tenant is null then
    insert into tenants (name, status) values ('Amanah Foundation', 'active')
    returning id into v_tenant;
  end if;

  -- Agent
  select id into v_agent from agents where tenant_id = v_tenant and name = 'Amanah Intake Agent';
  if v_agent is null then
    insert into agents (tenant_id, name, vertical, model, active, system_prompt)
    values (
      v_tenant,
      'Amanah Intake Agent',
      'charity',
      'gemini-flash-latest',
      true,
      'You are the intake assistant for Amanah Foundation, a charity that provides monthly food support to families in need in Bangladesh. Speak warmly, simply, and with respect. Greet the person, explain you need to ask a few short questions to check eligibility, then ask for one missing detail at a time. Keep replies short. Never promise support before eligibility is confirmed. Do not use em dashes.'
    )
    returning id into v_agent;
  end if;

  -- Field defs (delete + reinsert for a clean idempotent seed)
  delete from field_defs where agent_id = v_agent;
  insert into field_defs (tenant_id, agent_id, key, label, type, required, question_hint, sort_order) values
    (v_tenant, v_agent, 'income',            'Monthly household income (BDT)', 'number',  true, 'Ask for the approximate total monthly household income in taka.', 1),
    (v_tenant, v_agent, 'children_under_18', 'Number of children under 18',    'number',  true, 'Ask how many children under 18 live in the household.',        2),
    (v_tenant, v_agent, 'district',          'District of residence',          'string',  true, 'Ask which district they live in.',                              3),
    (v_tenant, v_agent, 'has_national_id',   'Has a national ID',              'boolean', true, 'Ask whether they have a national ID card (NID).',               4);

  -- Qualification rules
  delete from qualification_rules where agent_id = v_agent;
  insert into qualification_rules (tenant_id, agent_id, logic, conditions, on_qualified)
  values (
    v_tenant, v_agent, 'AND',
    '[
      {"field": "income",            "op": "<",  "value": 15000},
      {"field": "children_under_18", "op": ">=", "value": 1},
      {"field": "district",          "op": "in", "value": ["Cumilla", "Comilla", "Sylhet", "Rangpur", "Kurigram"]},
      {"field": "has_national_id",   "op": "==", "value": true}
    ]'::jsonb,
    '{"integration": "create_beneficiary", "notify": true}'::jsonb
  );

  -- Integration: create_beneficiary -> mock CRM
  delete from integrations where agent_id = v_agent and name = 'create_beneficiary';
  insert into integrations (
    tenant_id, agent_id, name, description, method, url, auth_type, auth_secret_ref,
    input_schema, field_mapping, enabled
  ) values (
    v_tenant, v_agent, 'create_beneficiary',
    'Creates a beneficiary record in the Amanah CRM when a family qualifies.',
    'POST',
    -- Resolved against APP_PUBLIC_URL at execution time if relative.
    '/api/mock-crm/beneficiaries',
    'bearer',
    'MOCK_CRM_TOKEN',
    '{
      "type": "object",
      "required": ["name", "income", "district", "children_under_18", "has_national_id"],
      "properties": {
        "name":              {"type": "string"},
        "income":            {"type": "number"},
        "district":          {"type": "string"},
        "children_under_18": {"type": "number"},
        "has_national_id":   {"type": "boolean"}
      }
    }'::jsonb,
    '{
      "name":              "contact.name",
      "income":            "income",
      "district":          "district",
      "children_under_18": "children_under_18",
      "has_national_id":   "has_national_id"
    }'::jsonb,
    true
  );
end $$;
