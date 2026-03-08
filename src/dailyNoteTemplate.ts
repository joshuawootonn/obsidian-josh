const PERIODIC_NOTES_SETTINGS_PATH = "plugins/periodic-notes/data.json";
const CORE_DAILY_NOTES_SETTINGS_PATH = "daily-notes.json";

interface TemplateSettingsReader {
  readConfig(path: string): Promise<string>;
  readTemplate(path: string): Promise<string | null>;
}

export async function resolveDailyTemplateContents(
  configDir: string,
  reader: TemplateSettingsReader,
): Promise<string> {
  const templatePath =
    (await readTemplatePathFromConfig(
      `${configDir}/${PERIODIC_NOTES_SETTINGS_PATH}`,
      parsePeriodicNotesDailyTemplatePath,
      reader,
    )) ??
    (await readTemplatePathFromConfig(
      `${configDir}/${CORE_DAILY_NOTES_SETTINGS_PATH}`,
      parseCoreDailyTemplatePath,
      reader,
    ));

  if (!templatePath) {
    return "";
  }

  return (await reader.readTemplate(templatePath)) ?? "";
}

export function parsePeriodicNotesDailyTemplatePath(configContents: string): string | null {
  const parsed = parseJson(configContents);
  const value = parsed?.daily?.template;

  return asNonEmptyString(value);
}

export function parseCoreDailyTemplatePath(configContents: string): string | null {
  const parsed = parseJson(configContents);

  return asNonEmptyString(parsed?.template);
}

async function readTemplatePathFromConfig(
  settingsPath: string,
  parser: (contents: string) => string | null,
  reader: TemplateSettingsReader,
): Promise<string | null> {
  try {
    return parser(await reader.readConfig(settingsPath));
  } catch {
    return null;
  }
}

function parseJson(contents: string): any {
  try {
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
