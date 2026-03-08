export const ISO_DATE_WIKILINK_REGEX = /\[\[(\d{4}-\d{2}-\d{2})(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

export interface DailyNoteSyncAdapter {
  resolveLink(linkText: string): boolean;
  exists(path: string): boolean;
  ensureFolder(path: string): Promise<void>;
  getInitialContents(): Promise<string>;
  create(path: string, contents: string): Promise<void>;
}

export interface EnsureMissingDailyNotesOptions {
  content: string;
  dailyFolder: string;
  adapter: DailyNoteSyncAdapter;
  pendingPaths: Set<string>;
}

export function extractIsoDateLinks(content: string): string[] {
  const uniqueDates = new Set<string>();

  for (const match of content.matchAll(ISO_DATE_WIKILINK_REGEX)) {
    const [, isoDate] = match;

    if (isoDate) {
      uniqueDates.add(isoDate);
    }
  }

  return [...uniqueDates];
}

export async function ensureMissingDailyNotes({
  content,
  dailyFolder,
  adapter,
  pendingPaths,
}: EnsureMissingDailyNotesOptions): Promise<void> {
  const isoDates = extractIsoDateLinks(content);

  if (isoDates.length === 0) {
    return;
  }

  let folderEnsured = false;
  let initialContentsPromise: Promise<string> | null = null;

  for (const isoDate of isoDates) {
    if (adapter.resolveLink(isoDate)) {
      continue;
    }

    const dailyNotePath = `${trimSlashes(dailyFolder)}/${isoDate}.md`;

    if (pendingPaths.has(dailyNotePath) || adapter.exists(dailyNotePath)) {
      continue;
    }

    pendingPaths.add(dailyNotePath);

    try {
      if (!folderEnsured) {
        await adapter.ensureFolder(dailyFolder);
        folderEnsured = true;
      }

      initialContentsPromise ??= adapter.getInitialContents();

      await adapter.create(dailyNotePath, await initialContentsPromise);
    } finally {
      pendingPaths.delete(dailyNotePath);
    }
  }
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}
