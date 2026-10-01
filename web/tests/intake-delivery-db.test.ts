import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { databaseHarness } from "./database-harness";
let db: PGlite, w: string, p: string, material: string;
const hash = "a".repeat(64),
  pdfHash = "b".repeat(64),
  inputHash = "c".repeat(64);
async function row(sql: string, args: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, args)).rows[0];
}
async function checked(sql: string, args: unknown[] = []) {
  await db.exec("savepoint check_call");
  try {
    const r = await row(sql, args);
    await db.exec("release savepoint check_call");
    return r;
  } catch (e) {
    await db.exec(
      "rollback to savepoint check_call; release savepoint check_call",
    );
    throw e;
  }
}
async function intake(input: unknown, id = randomUUID(), workspace = w) {
  return (
    await checked("select hq_request_job_intake($1,$2,$3) as result", [
      workspace,
      id,
      input,
    ])
  ).result as Record<string, unknown>;
}
async function object(
  bucket: string,
  path: string,
  size = 80,
  mime = "application/pdf",
) {
  return checked(
    "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3) returning id",
    [bucket, path, { size, mimetype: mime }],
  );
}
async function artifact(
  format = "docx",
  changes: Record<string, unknown> = {},
) {
  const h = format === "docx" ? hash : pdfHash;
  const data = {
    workspace_id: w,
    application_material_id: material,
    format,
    storage_path: `${w}/${material}/${h}.${format}`,
    sha256: h,
    byte_size: 80,
    renderer_key: "executive-brief-two-page-v2",
    input_sha256: inputHash,
    source_docx_sha256: hash,
    qa: {
      visual_pass: true,
      parse_back_pass: true,
      page_count: 2,
      renderer_key: "executive-brief-two-page-v2",
      input_sha256: inputHash,
      docx_sha256: hash,
      pdf_sha256: pdfHash,
    },
    ...changes,
  };
  return checked(
    `insert into application_material_artifacts(workspace_id,application_material_id,format,storage_path,sha256,byte_size,renderer_key,input_sha256,source_docx_sha256,qa) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    Object.values(data),
  );
}
beforeAll(async () => {
  db = (await databaseHarness()).db;
}, 30000);
afterAll(async () => db.close());
beforeEach(async () => {
  await db.exec("begin");
  const user = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  w = (
    await row(
      "select bootstrap_personal_workspace('Local intake test',$1) as id",
      ["test-" + randomUUID()],
    )
  ).id as string;
  p = (await row("select current_principal_id() as id")).id as string;
  await db.exec("set local role authenticated");
  const company = (
    await row(
      "insert into companies(workspace_id,name) values($1,'Synthetic only') returning id",
      [w],
    )
  ).id;
  const opp = (
    await row(
      "insert into opportunities(workspace_id,company_id,title,opportunity_stage) values($1,$2,'Synthetic role','pursuing') returning id",
      [w, company],
    )
  ).id;
  const ev = (
    await row(
      "insert into evaluations(workspace_id,opportunity_id) values($1,$2) returning id",
      [w, opp],
    )
  ).id;
  await db.query(
    "update evaluations set evaluation_status='complete',candidate_fit_score=80,opportunity_fit_score=80,opportunity_type='mutual_fit',evidence_confidence='high',problem_translation='Synthetic need',recommended_next_action='pursue' where id=$1",
    [ev],
  );
  const pkg = (
    await row(
      "insert into application_packages(workspace_id,opportunity_id,evaluation_id) values($1,$2,$3) returning id",
      [w, opp, ev],
    )
  ).id;
  material = (
    await row(
      "insert into application_materials(workspace_id,application_package_id,material_type,content_text) values($1,$2,'resume','Synthetic version one') returning id",
      [w, pkg],
    )
  ).id as string;
});
afterEach(async () => db.exec("rollback"));
describe("manual intake under existing RLS", () => {
  it.each([
    { mode: "url", url: "https://example.invalid/careers/role" },
    {
      mode: "text",
      text: "User supplied job description for a synthetic operations role.",
    },
  ])(
    "queues one existing intake task with unverified evidence: $mode",
    async (input) => {
      const id = randomUUID(),
        a = await intake(input, id),
        b = await intake(input, id);
      expect(a).toEqual(b);
      const e = await row("select * from activity_events where id=$1", [
        a.event_id,
      ]);
      expect(JSON.parse(e.details as string)).toMatchObject({
        source_kind: "user_provided",
        employer_verified: false,
        input,
      });
      const task = await row("select * from internal_tasks where id=$1", [
        a.task_id,
      ]);
      expect(task).toMatchObject({
        task_type: "job_alert_intake",
        domain: "discovery",
        status: "ready",
        trigger_type: "event",
        source_activity_event_id: a.event_id,
        opportunity_id: null,
      });
      expect(
        (
          await row(
            "select count(*)::int n from internal_tasks where task_type='evaluate_opportunity'",
          )
        ).n,
      ).toBe(0);
      expect((await row("select count(*)::int n from opportunities")).n).toBe(
        1,
      );
    },
  );
  it("does not reuse a request for different evidence", async () => {
    const id = randomUUID();
    await intake({ mode: "url", url: "https://example.invalid/a" }, id);
    await expect(
      intake({ mode: "url", url: "https://example.invalid/b" }, id),
    ).rejects.toThrow("different intake evidence");
  });
  it.each([
    { mode: "text", text: "short" },
    { mode: "url", url: "http://example.invalid/a" },
    { mode: "url", url: "https://user@evil.invalid/a" },
    { mode: "url", url: "https://example.invalid/a", employer_verified: true },
    { mode: "upload", upload: {} },
    { mode: "upload", upload: { storage_path: "foreign" } },
  ])("rejects malformed or authority-bearing evidence", async (input) => {
    await expect(intake(input)).rejects.toThrow();
    expect((await row("select count(*)::int n from activity_events")).n).toBe(
      0,
    );
  });
  it("requires matching immutable private upload and rejects replacement", async () => {
    const id = randomUUID(),
      path = `${w}/${p}/${id}/${hash}.pdf`;
    const upload = {
      storage_path: path,
      sha256: hash,
      byte_size: 80,
      mime_type: "application/pdf",
      name: "Recruiter.pdf",
    };
    await expect(intake({ mode: "upload", upload }, id)).rejects.toThrow(
      "Upload",
    );
    await object("hq-intake", path);
    await intake({ mode: "upload", upload }, id);
    expect(
      await checked(
        "update storage.objects set metadata='{\"size\":90}' where name=$1 returning id",
        [path],
      ),
    ).toBeUndefined();
    expect(
      (await row("select metadata from storage.objects where name=$1", [path]))
        .metadata,
    ).toMatchObject({ size: 80 });
    expect(
      await checked("delete from storage.objects where name=$1 returning id", [
        path,
      ]),
    ).toBeUndefined();
  });
  it("rejects foreign workspace and agent intake", async () => {
    await expect(
      intake(
        { mode: "url", url: "https://example.invalid/a" },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toThrow("Active human");
    await db.exec("reset role");
    await db.query("update principals set principal_type='agent' where id=$1", [
      p,
    ]);
    await db.exec("set local role authenticated");
    await expect(
      intake({ mode: "url", url: "https://example.invalid/a" }),
    ).rejects.toThrow("Active human");
  });
  it("denies anon execution and data", async () => {
    await db.exec("reset role; set local role anon");
    await expect(
      checked("select hq_request_job_intake($1,$2,$3)", [
        w,
        randomUUID(),
        { mode: "text", text: "x".repeat(80) },
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      checked("select * from application_material_artifacts"),
    ).rejects.toThrow("permission denied");
  });
});
describe("exact immutable material artifacts", () => {
  it("registers exact representations without modifying Material", async () => {
    for (const format of ["docx", "pdf"]) {
      await object(
        "hq-materials",
        `${w}/${material}/${format === "docx" ? hash : pdfHash}.${format}`,
        80,
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
      );
      await artifact(format);
    }
    expect(
      (await row("select count(*)::int n from application_material_artifacts"))
        .n,
    ).toBe(2);
    expect(
      (
        await row(
          "select content_text from application_materials where id=$1",
          [material],
        )
      ).content_text,
    ).toBe("Synthetic version one");
    await expect(
      checked("update application_material_artifacts set sha256=$1", [pdfHash]),
    ).rejects.toThrow("permission denied");
    await expect(
      checked("delete from application_material_artifacts"),
    ).rejects.toThrow("permission denied");
  });
  it("rejects missing object, failed QA, wrong renderer, third page, missing QA, foreign paths", async () => {
    await expect(artifact()).rejects.toThrow("Upload");
    await object(
      "hq-materials",
      `${w}/${material}/${hash}.docx`,
      80,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    for (const change of [
      { qa: {} },
      {
        qa: {
          visual_pass: true,
          parse_back_pass: true,
          page_count: 2,
          renderer_key: null,
          input_sha256: null,
          docx_sha256: null,
          pdf_sha256: null,
        },
      },
      { qa: { visual_pass: false, parse_back_pass: true, page_count: 2 } },
      { renderer_key: "new-unapproved-renderer" },
      { qa: { visual_pass: true, parse_back_pass: true, page_count: 3 } },
      { storage_path: `${w}/${randomUUID()}/${hash}.docx` },
    ])
      await expect(artifact("docx", change)).rejects.toThrow();
  });
  it("rejects a PDF converted from different DOCX or input", async () => {
    await object(
      "hq-materials",
      `${w}/${material}/${hash}.docx`,
      80,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await artifact();
    await object("hq-materials", `${w}/${material}/${pdfHash}.pdf`);
    await expect(
      artifact("pdf", { source_docx_sha256: pdfHash }),
    ).rejects.toThrow("exact source");
    await expect(artifact("pdf", { input_sha256: pdfHash })).rejects.toThrow(
      "exact source",
    );
  });
  it("rejects attachment to reviewed Material", async () => {
    await object(
      "hq-materials",
      `${w}/${material}/${hash}.docx`,
      80,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await db.query(
      "update application_materials set status='candidate_review' where id=$1",
      [material],
    );
    await expect(artifact()).rejects.toThrow("current draft");
    await expect(
      object("hq-materials", `${w}/${material}/${pdfHash}.pdf`),
    ).rejects.toThrow("row-level security");
  });
  it("restrictive guards defeat unrelated broad object policies", async () => {
    await db.exec("reset role");
    await db.exec(
      "create policy synthetic_broad_access on storage.objects for all to authenticated using(true) with check(true)",
    );
    await db.exec("set local role authenticated");
    await expect(
      object("hq-materials", `${randomUUID()}/${randomUUID()}/${hash}.pdf`),
    ).rejects.toThrow("row-level security");
    await object("hq-intake", `${w}/${p}/${randomUUID()}/${hash}.pdf`);
    expect(
      await checked("update storage.objects set name=name returning id"),
    ).toBeUndefined();
    expect(
      await checked("delete from storage.objects returning id"),
    ).toBeUndefined();
  });
});
describe("unchanged agent authority and membership boundaries", () => {
  it("lets the original twelve-permission preparer publish files without intake or approval authority", async () => {
    await db.exec("reset role");
    const user = randomUUID();
    await db.query("insert into auth.users(id) values($1)", [user]);
    const agent = await row(
      "insert into principals(principal_type,auth_user_id,name) values('agent',$1,'Synthetic original preparer') returning id",
      [user],
    );
    const role = await row(
      "insert into roles(workspace_id,name) values($1,'Synthetic original twelve permissions') returning id",
      [w],
    );
    await db.query(
      "insert into role_permissions(role_id,permission_id) select $1,id from permissions where permission_key in ('workspace.read','company.read','job_family.read','opportunity.read','opportunity_source.read','company_intelligence.read','candidate_knowledge.read','settings.read','evaluation.read','application_gap.read','application.read','application.prepare')",
      [role.id],
    );
    expect(
      (
        await row(
          "select count(*)::int n from role_permissions where role_id=$1",
          [role.id],
        )
      ).n,
    ).toBe(12);
    await db.query(
      "insert into workspace_memberships(workspace_id,principal_id,role_id) values($1,$2,$3)",
      [w, agent.id, role.id],
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await db.exec("set local role authenticated");
    for (const format of ["docx", "pdf"]) {
      await object(
        "hq-materials",
        `${w}/${material}/${format === "docx" ? hash : pdfHash}.${format}`,
        80,
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
      );
      await artifact(format);
    }
    expect(
      (
        await row(
          "select count(*)::int n from application_material_artifacts where created_by_principal_id=$1",
          [agent.id],
        )
      ).n,
    ).toBe(2);
    expect(
      await row(
        "select has_permission($1,'application.approve') approve,has_permission($1,'application.submit') submit,has_permission($1,'internal_task.execute') execute",
        [w],
      ),
    ).toEqual({ approve: false, submit: false, execute: false });
    await expect(
      intake({ mode: "url", url: "https://example.invalid/a" }),
    ).rejects.toThrow("Active human");
    await db.query(
      "update application_materials set status='candidate_review' where id=$1",
      [material],
    );
    await expect(
      checked(
        "update application_materials set status='approved' where id=$1 returning id",
        [material],
      ),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.query(
      "update workspace_memberships set status='inactive' where principal_id=$1 and workspace_id=$2",
      [agent.id, w],
    );
    await db.exec("set local role authenticated");
    expect(
      (await row("select count(*)::int n from application_material_artifacts"))
        .n,
    ).toBe(0);
    expect((await row("select count(*)::int n from storage.objects")).n).toBe(
      0,
    );
  });
  it("hides artifact metadata and bytes from an unrelated authenticated human", async () => {
    await object(
      "hq-materials",
      `${w}/${material}/${hash}.docx`,
      80,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await artifact();
    await db.exec("reset role");
    const user = randomUUID();
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query(
      "insert into principals(principal_type,auth_user_id,name) values('human',$1,'Unrelated synthetic human')",
      [user],
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await db.exec("set local role authenticated");
    expect(
      (await row("select count(*)::int n from application_material_artifacts"))
        .n,
    ).toBe(0);
    expect((await row("select count(*)::int n from storage.objects")).n).toBe(
      0,
    );
    await expect(artifact("pdf")).rejects.toThrow();
  });
});
