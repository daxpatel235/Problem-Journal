import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DownloadIcon, RotateCcwIcon, SaveIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/tauri";
import { openTextFromFile, saveTextToFile } from "@/lib/exportFile";
import { useProblemStore } from "@/stores/problemStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { ZOOM_LEVELS, type BackupInfo, type ZoomLevel } from "@/types/settings";

export function SettingsPanel() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const closeSettings = useUiStore((s) => s.closeSettings);

  const zoomLevel = useSettingsStore((s) => s.zoomLevel);
  const setZoom = useSettingsStore((s) => s.setZoom);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const autosaveEnabled = useSettingsStore((s) => s.autosaveEnabled);
  const setAutosaveEnabled = useSettingsStore((s) => s.setAutosaveEnabled);
  const backupDir = useSettingsStore((s) => s.backupDir);
  const setBackupDir = useSettingsStore((s) => s.setBackupDir);
  const backupRetention = useSettingsStore((s) => s.backupRetention);
  const setBackupRetention = useSettingsStore((s) => s.setBackupRetention);

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (settingsOpen) void refreshBackups();
  }, [settingsOpen]);

  async function refreshBackups() {
    try {
      setBackups(await api.backups.list());
    } catch (err) {
      console.error("Failed to list backups", err);
    }
  }

  async function handleCreateBackup() {
    setIsWorking(true);
    try {
      await api.backups.create();
      await refreshBackups();
      toast.success("Backup created");
    } catch (err) {
      toast.error(`Backup failed: ${String(err)}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRestoreBackup(path: string) {
    setIsWorking(true);
    try {
      await api.backups.restore(path);
      toast.success("Backup restored");
    } catch (err) {
      toast.error(`Restore failed: ${String(err)}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleExportAll() {
    try {
      const json = await api.export.allJson();
      const saved = await saveTextToFile(json, "problem-journal-export.json", ["json"]);
      if (saved) toast.success("Exported all problems");
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  }

  async function handleImport() {
    setIsWorking(true);
    try {
      const json = await openTextFromFile(["json"]);
      if (json === null) return; // dialog cancelled
      const count = await api.problems.importJson(json);
      await useProblemStore.getState().fetchProblems();
      toast.success(`Imported ${count} problem${count === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(`Import failed: ${String(err)}`);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={(open: boolean) => !open && closeSettings()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Zoom, backups, and export options.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <section className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <div className="flex gap-1">
              {(["system", "light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === theme
                      ? "bg-primary text-primary-foreground"
                      : "bg-hover text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Zoom Level</Label>
            <div className="flex flex-wrap gap-1">
              {ZOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setZoom(level as ZoomLevel)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    level === zoomLevel
                      ? "bg-primary text-primary-foreground"
                      : "bg-hover text-muted-foreground hover:text-foreground",
                  )}
                >
                  {level}%
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-muted-foreground">Autosave</Label>
              <Switch
                checked={autosaveEnabled}
                onCheckedChange={(checked: boolean) => setAutosaveEnabled(checked)}
                aria-label="Toggle autosave"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Saves your work automatically a couple of seconds after you stop
              typing — like the auto-save in VS Code / Code Runner. You never have
              to think about saving: switching problems and closing the app both
              flush any remaining changes first, so nothing is ever lost and the
              app reopens exactly where you left off.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {autosaveEnabled
                ? "Autosave is on. You can still save any time with the Save button or Ctrl+S."
                : "Autosave is off — use the Save button or Ctrl+S. As a safety net, anything unsaved is still saved when you close the app."}
            </p>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Backups</Label>
            <div className="flex gap-2">
              <Input
                value={backupDir}
                onChange={(e) => setBackupDir(e.target.value)}
                placeholder="~/.problem-journal/backups"
                className="h-8 flex-1 bg-input/30 text-xs"
              />
              <Input
                type="number"
                min={1}
                value={backupRetention}
                onChange={(e) => setBackupRetention(Number(e.target.value) || 1)}
                className="h-8 w-16 bg-input/30 text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCreateBackup}
              disabled={isWorking}
              className="w-fit gap-1"
            >
              <SaveIcon className="size-3.5" />
              Create Backup Now
            </Button>

            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1.5">
              {backups.length === 0 && (
                <p className="p-1 text-xs text-muted-foreground">No backups yet.</p>
              )}
              {backups.map((backup) => (
                <div
                  key={backup.path}
                  className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-hover"
                >
                  <span className="truncate text-xs">{backup.fileName}</span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={isWorking}
                    onClick={() => handleRestoreBackup(backup.path)}
                    aria-label="Restore backup"
                  >
                    <RotateCcwIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Export &amp; Import</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportAll}
                className="w-fit gap-1"
              >
                <DownloadIcon className="size-3.5" />
                Export All as JSON
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleImport}
                disabled={isWorking}
                className="w-fit gap-1"
              >
                <UploadIcon className="size-3.5" />
                Import from JSON
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Import adds problems from an exported JSON file as new entries — it
              never overwrites what you already have. To fully restore a previous
              state instead, use a backup above.
            </p>
          </section>

          <Separator />

          <section className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Problem Journal</p>
            <p>Every problem. Every pattern. Every insight.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
