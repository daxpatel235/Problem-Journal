import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export async function saveTextToFile(
  content: string,
  defaultFileName: string,
  extensions: string[],
): Promise<boolean> {
  const path = await save({
    defaultPath: defaultFileName,
    filters: [{ name: extensions.join("/"), extensions }],
  });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}

export async function openTextFromFile(extensions: string[]): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: extensions.join("/"), extensions }],
  });
  if (typeof path !== "string") return null;
  return readTextFile(path);
}

export function openHtmlForPrint(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
