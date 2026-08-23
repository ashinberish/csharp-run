import { cn } from "@/lib/utils";

interface StatusBarProps {
  statusText: string;
  busy: boolean;
  line: number;
  column: number;
  languageVersion: string;
}

export function StatusBar({ statusText, busy, line, column, languageVersion }: StatusBarProps) {
  return (
    <div
      className={cn(
        "flex h-6 shrink-0 items-center justify-between px-3 font-mono text-[11px] font-semibold text-[#0d1117] transition-colors",
        busy ? "bg-yellow" : "bg-blue",
      )}
    >
      <span>{statusText}</span>
      <div className="flex gap-3.5">
        <span>
          Ln {line}, Col {column}
        </span>
        <span>C# {languageVersion}</span>
      </div>
    </div>
  );
}
