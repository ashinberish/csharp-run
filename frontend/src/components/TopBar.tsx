import { ChevronDown, Download, FilePlus, Loader2, Settings, SquareTerminal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FileLanguage } from "@/lib/session";
import { isMac } from "@/lib/shortcut";

interface TopBarProps {
  running: boolean;
  runtimeReady: boolean;
  onRun: () => void;
  onNewFile: (language: FileLanguage) => void;
  onDownload: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ running, runtimeReady, onRun, onNewFile, onDownload, onOpenSettings }: TopBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-3.5">
      <div className="flex items-center gap-2 font-mono text-sm font-bold tracking-wide">
        <SquareTerminal className="size-[17px] text-blue" strokeWidth={2.25} />
        <span className="text-blue">csharp</span>
        <span className="text-yellow">//</span>
        <span>run</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" title="Settings" onClick={onOpenSettings}>
          <Settings />
        </Button>

        <Button variant="outline" title="Download current file" onClick={onDownload}>
          <Download />
          .cs
        </Button>

        <div className="flex">
          <Button
            variant="outline"
            className="rounded-r-none"
            title="New C# file"
            onClick={() => onNewFile("csharp")}
          >
            <FilePlus />
            New
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "-ml-px rounded-l-none")}
              title="New file…"
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onNewFile("csharp")}>C# file</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNewFile("markdown")}>Markdown file</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          disabled={!runtimeReady || running}
          onClick={onRun}
          className="bg-gradient-to-r from-blue to-[#3f7aa8] px-4 text-white hover:brightness-110 disabled:bg-border disabled:text-muted-foreground disabled:opacity-100"
        >
          {!runtimeReady ? (
            <>
              <Loader2 className="animate-spin" />
              Loading…
            </>
          ) : running ? (
            <>
              <Loader2 className="animate-spin" />
              Running…
            </>
          ) : (
            <>
              Run
              <kbd className="rounded bg-white/10 px-1 font-mono text-[10px] font-normal opacity-65">
                {isMac ? "⌘" : "Ctrl"}⏎
              </kbd>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
