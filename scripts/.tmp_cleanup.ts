import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const r = await db.auth.admin.deleteUser("7f1a28ce-b4a7-4c5a-8e0f-7b74795802fb");
console.log("delete user:", r.error ? r.error.message : "ok");
console.log(JSON.stringify((await db.from("treasury_flows").select("flow_type,account,amount,reference_type,reference_id,created_at")).data));
