/** Converte string com vírgulas em array de tags normalizadas. */
export function parseTags(input: string | null | undefined): string[] {
  if (!input) return [];
  return Array.from(
    new Set(
      input
        .split(/[,;\n]/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 30),
    ),
  ).slice(0, 10);
}

/** Serializa array de tags para exibição em input. */
export function stringifyTags(tags: string[] | null | undefined): string {
  return (tags ?? []).join(", ");
}
