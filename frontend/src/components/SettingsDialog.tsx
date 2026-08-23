import { Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Shortcut, Theme } from "@/lib/session";
import { ShortcutRecorder } from "@/components/ShortcutRecorder";

const LANGUAGE_VERSIONS = [
  { value: "CSharp10", label: "C# 10" },
  { value: "CSharp11", label: "C# 11" },
  { value: "CSharp12", label: "C# 12" },
  { value: "CSharp13", label: "C# 13" },
  { value: "Latest", label: "Latest" },
  { value: "Preview", label: "Preview" },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  languageVersion: string;
  onLanguageVersionChange: (version: string) => void;
  intellisenseEnabled: boolean;
  onIntellisenseChange: (enabled: boolean) => void;
  formatShortcut: Shortcut;
  onFormatShortcutChange: (shortcut: Shortcut) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  theme,
  onThemeChange,
  languageVersion,
  onLanguageVersionChange,
  intellisenseEnabled,
  onIntellisenseChange,
  formatShortcut,
  onFormatShortcutChange,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(420px,92vw)] gap-0 p-0">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-3 space-y-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <SettingsIcon className="size-4 text-blue" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4.5 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Theme</span>
              <span className="text-[11px] text-muted-foreground">Switch between dark and light mode</span>
            </div>
            <Switch
              checked={theme === "light"}
              onCheckedChange={(checked) => onThemeChange(checked ? "light" : "dark")}
            />
          </label>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">C# language version</span>
              <span className="text-[11px] text-muted-foreground">
                Passed to the compiler; unlike py-run's Python version picker this doesn't swap
                runtimes or reload the page.
              </span>
            </div>
            <Select value={languageVersion} onValueChange={(v) => v && onLanguageVersionChange(v)}>
              <SelectTrigger className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_VERSIONS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">IntelliSense</span>
              <span className="text-[11px] text-muted-foreground">
                Autocomplete, hover docs &amp; signature help via Roslyn.
              </span>
            </div>
            <Switch checked={intellisenseEnabled} onCheckedChange={onIntellisenseChange} />
          </label>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Format shortcut</span>
              <span className="text-[11px] text-muted-foreground">
                Formats the active C# file. Click, then press a new key combination.
              </span>
            </div>
            <ShortcutRecorder value={formatShortcut} onChange={onFormatShortcutChange} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
