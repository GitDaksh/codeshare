// Monaco (via VS Code's BrowserClipboardService) enables a WebKit-only
// workaround: on every click/keydown on the page, it pre-arms a clipboard
// write using a ClipboardItem backed by a deferred promise, so a later Cmd+C
// can succeed under Safari's strict clipboard rules.
//
// Two side effects surface as errors, neither of which affects behavior:
//   1. Safari often refuses the pre-armed write -> Monaco logs "NotAllowedError".
//   2. Each new click cancels the previous deferred promise -> "Canceled",
//      which nothing ever handles -> unhandled promise rejection.
//
// This shim neutralizes both. It installs only under the same condition Monaco
// uses (AppleWebKit without "Chrome" in the UA), so Chromium browsers and
// Firefox are completely unaffected.

let installed = false;

function isAffectedWebKit(): boolean {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrome/.test(ua);
}

export function installSafariClipboardShim(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  if (!isAffectedWebKit()) return;

  const clipboard = navigator.clipboard;
  if (clipboard && typeof clipboard.write === "function") {
    const originalWrite = clipboard.write.bind(clipboard);
    clipboard.write = (data: ClipboardItems) =>
      originalWrite(data).catch((err: unknown) => {
        if ((err as { name?: string } | null)?.name === "NotAllowedError") return;
        throw err;
      });
  }

  const OriginalClipboardItem = window.ClipboardItem;
  if (typeof OriginalClipboardItem === "function") {
    class HandledClipboardItem extends OriginalClipboardItem {
      constructor(
        items: Record<string, string | Blob | PromiseLike<string | Blob>>,
        options?: ClipboardItemOptions
      ) {
        // Attach a no-op handler to any promise-backed entries so a later
        // cancellation is never reported as an unhandled rejection. Anyone
        // else awaiting these promises still receives the rejection as normal.
        for (const value of Object.values(items)) {
          if (value && typeof (value as PromiseLike<unknown>).then === "function") {
            Promise.resolve(value).catch(() => {});
          }
        }
        super(items, options);
      }
    }

    (window as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem = HandledClipboardItem;
  }
}