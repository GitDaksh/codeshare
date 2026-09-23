export type FormatResult = {
  formatted: string | null;
  error: string | null;
};

const FORMATTABLE_LANGUAGES = new Set(["javascript", "typescript"]);

export function isFormattable(language: string): boolean {
  return FORMATTABLE_LANGUAGES.has(language);
}

export async function formatCode(code: string, language: string): Promise<FormatResult> {
  if (!isFormattable(language)) {
    return { formatted: null, error: "Formatting isn't supported for this language yet." };
  }

  try {
    const prettier = await import("prettier/standalone");
    const prettierPluginEstree = await import("prettier/plugins/estree");

    if (language === "javascript") {
      const prettierPluginBabel = await import("prettier/plugins/babel");
      const formatted = await prettier.format(code, {
        parser: "babel",
        // Dynamic-import module namespace objects don't structurally match
        // Prettier's own Plugin type — a known TS/ESM interop gap, not a real risk.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plugins: [prettierPluginBabel, prettierPluginEstree] as any,
      });
      return { formatted, error: null };
    }

    const prettierPluginTypescript = await import("prettier/plugins/typescript");
    const formatted = await prettier.format(code, {
      parser: "typescript",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [prettierPluginTypescript, prettierPluginEstree] as any,
    });
    return { formatted, error: null };
  } catch (err) {
    return {
      formatted: null,
      error: err instanceof Error ? err.message : "Could not format this code.",
    };
  }
}