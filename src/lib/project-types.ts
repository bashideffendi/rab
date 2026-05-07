/**
 * Jenis project — common types untuk konstruksi Indonesia.
 * Pakai key kanonik di DB (snake_case), label readable buat UI.
 */

export const PROJECT_TYPES = [
  { value: "rumah_tapak", label: "Rumah Tapak", icon: "🏠" },
  { value: "rumah_susun", label: "Rumah Susun / Apartemen", icon: "🏢" },
  { value: "ruko", label: "Ruko / Shop-house", icon: "🏪" },
  { value: "kantor", label: "Kantor", icon: "🏢" },
  { value: "gudang", label: "Gudang", icon: "🏭" },
  { value: "sekolah", label: "Sekolah / Pendidikan", icon: "🏫" },
  { value: "ibadah", label: "Tempat Ibadah", icon: "🕌" },
  { value: "kesehatan", label: "Fasilitas Kesehatan", icon: "🏥" },
  { value: "gedung_pertemuan", label: "Gedung Pertemuan", icon: "🏛️" },
  { value: "jalan", label: "Jalan", icon: "🛣️" },
  { value: "jembatan", label: "Jembatan", icon: "🌉" },
  { value: "saluran", label: "Saluran / Drainase / Irigasi", icon: "💧" },
  { value: "renovasi", label: "Renovasi", icon: "🔨" },
  { value: "lainnya", label: "Lainnya", icon: "📦" },
] as const;

export type ProjectTypeValue = (typeof PROJECT_TYPES)[number]["value"];

export function projectTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const match = PROJECT_TYPES.find((t) => t.value === value);
  return match?.label ?? value;
}

export function projectTypeIcon(value: string | null | undefined): string {
  if (!value) return "📋";
  const match = PROJECT_TYPES.find((t) => t.value === value);
  return match?.icon ?? "📋";
}
