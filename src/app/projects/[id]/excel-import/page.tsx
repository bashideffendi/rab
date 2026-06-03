import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, verifyProjectOwnership } from "@/lib/auth";
import { ExcelImportClient } from "./client";

export default async function ExcelImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await verifyProjectOwnership(id, user.id);
  } catch {
    notFound();
  }
  const [proj] = await db
    .select({ name: schema.projects.name })
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);
  if (!proj) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/projects/${id}`}
        className="text-sm text-muted-foreground transition-colors hover:text-accent"
      >
        ← {proj.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        Import RAB dari Excel
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Upload file <span className="font-mono">.xlsx</span> dengan kolom{" "}
        <strong>Nama/Uraian</strong>, <strong>Satuan</strong>,{" "}
        <strong>Volume</strong>, dan <strong>Harga Satuan</strong>. Baris masuk
        sebagai item custom — bisa langsung diedit (inline) setelah import.
      </p>
      <ExcelImportClient projectId={id} />
    </main>
  );
}
