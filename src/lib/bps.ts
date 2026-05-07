/**
 * BPS Web API client.
 * Docs: https://webapi.bps.go.id (perlu API key)
 *
 * Endpoint umum:
 * - /list?model=subject&...&key=  : list subjects (topics)
 * - /list?model=var&subject=&...&key=  : list variables di subject
 * - /list?model=th&...&key=  : list tahun yang tersedia
 * - /list?model=domain&...&key=  : list domain (wilayah)
 * - /view?model=data&domain=&var=&th=&key=  : actual data
 *
 * Response BPS API biasanya nested array. Kita normalize jadi shape yg friendly.
 */

const BASE = "https://webapi.bps.go.id/v1/api";

function getApiKey(): string {
  const key = process.env.BPS_API_KEY;
  if (!key) {
    throw new Error(
      "BPS_API_KEY belum diset. Tambah ke .env.local: BPS_API_KEY=...",
    );
  }
  return key;
}

async function bpsGet<T = unknown>(
  endpoint: "list" | "view",
  params: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set("key", getApiKey());

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "rabin-tool/1.0" },
  });

  if (!res.ok) {
    throw new Error(`BPS API ${res.status} ${res.statusText} for ${endpoint}`);
  }

  const json = (await res.json()) as T;
  return json;
}

// ─── List subjects ──────────────────────────────────────────────────────────

export type BpsSubject = {
  sub_id: number;
  title: string;
  subcat_id?: number;
  subcat?: string;
};

export async function listSubjects(opts?: {
  page?: number;
  perPage?: number;
}): Promise<BpsSubject[]> {
  const params: Record<string, string | number> = {
    model: "subject",
    domain: "0000", // nasional
    page: opts?.page ?? 1,
    perpage: opts?.perPage ?? 100,
  };
  const json = await bpsGet<RawListResponse<BpsSubject>>("list", params);
  return extractDataArray(json);
}

// ─── List variables di subject ──────────────────────────────────────────────

export type BpsVariable = {
  var_id: number;
  title: string;
  sub_id?: number;
  sub_name?: string;
  def?: string;
  notes?: string;
  vertical?: number;
};

export async function listVariables(opts: {
  subjectId: number;
  domain?: string;
  page?: number;
  perPage?: number;
}): Promise<BpsVariable[]> {
  const json = await bpsGet<RawListResponse<BpsVariable>>("list", {
    model: "var",
    domain: opts.domain ?? "0000",
    subject: opts.subjectId,
    page: opts.page ?? 1,
    perpage: opts.perPage ?? 100,
  });
  return extractDataArray(json);
}

// ─── List domain (wilayah) ───────────────────────────────────────────────────

export type BpsDomain = {
  domain_id: string; // BPS code, e.g., "1101" Aceh Selatan
  domain_name: string;
};

export async function listDomains(opts?: {
  type?: number; // 1=provinsi, 2=kabupaten/kota
  page?: number;
  perPage?: number;
}): Promise<BpsDomain[]> {
  const params: Record<string, string | number> = {
    model: "domain",
    page: opts?.page ?? 1,
    perpage: opts?.perPage ?? 700, // 514 kab/kota ≈ 514, kasih buffer
  };
  if (opts?.type) params["type"] = opts.type;
  const json = await bpsGet<RawListResponse<BpsDomain>>("list", params);
  return extractDataArray(json);
}

// ─── List years ──────────────────────────────────────────────────────────────

export type BpsYear = {
  th_id: number;
  th: string; // "2024", "2024 Sm 1", etc.
};

export async function listYears(opts: {
  variableId: number;
  domain?: string;
}): Promise<BpsYear[]> {
  const json = await bpsGet<RawListResponse<BpsYear>>("list", {
    model: "th",
    domain: opts.domain ?? "0000",
    var: opts.variableId,
    perpage: 50,
  });
  return extractDataArray(json);
}

// ─── View data ───────────────────────────────────────────────────────────────

export type BpsDataPoint = {
  domainId: string; // wilayah code
  domainName?: string;
  varId: number;
  yearId: number;
  yearLabel?: string;
  value: number | null;
};

/**
 * Fetch actual data values dari BPS view endpoint.
 * Response BPS view nested: { vervar: [...], var: [...], turvar: [...],
 * tahun: [...], turtahun: [...], datacontent: { "<key>": value } }
 *
 * Key di datacontent format: {vervar_id}{var_id}{turvar_id}{tahun_id}{turtahun_id}
 * — tergantung dataset, kombinasi-nya bisa bervariasi.
 */
export async function viewData(opts: {
  variableId: number;
  domain: string;
  yearId?: number;
  vertical?: number;
}): Promise<BpsViewResponse> {
  const params: Record<string, string | number> = {
    model: "data",
    domain: opts.domain,
    var: opts.variableId,
  };
  if (opts.yearId) params["th"] = opts.yearId;
  if (opts.vertical !== undefined) params["vertical"] = opts.vertical;
  const json = await bpsGet<BpsViewResponse>("view", params);
  return json;
}

// ─── Internal types ──────────────────────────────────────────────────────────

type RawListResponse<T> = {
  status?: string;
  "data-availability"?: string;
  data?: [{ pages?: number; total?: number }, T[]] | T[];
};

function extractDataArray<T>(json: RawListResponse<T>): T[] {
  const data = json.data;
  if (!data) return [];
  // Nested format: [meta, items[]]
  if (Array.isArray(data) && data.length === 2 && Array.isArray(data[1])) {
    return data[1] as T[];
  }
  // Flat format
  if (Array.isArray(data)) return data as T[];
  return [];
}

export type BpsViewResponse = {
  status?: string;
  "data-availability"?: string;
  vervar?: Array<{ val: number; label: string; kode_ver_id?: string }>;
  var?: Array<{ val: number; label: string }>;
  turvar?: Array<{ val: number; label: string }>;
  tahun?: Array<{ val: number; label: string }>;
  turtahun?: Array<{ val: number; label: string }>;
  datacontent?: Record<string, number | null>;
};
