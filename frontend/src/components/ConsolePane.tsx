import { useEffect, useRef } from "react";
import { Copy, SquareTerminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type OutputStream = "stdout" | "stderr" | "system" | "error";

export interface OutputLine {
  stream: OutputStream;
  text: string;
}

interface ConsolePaneProps {
  lines: OutputLine[];
  onClear: () => void;
}

export function ConsolePane({ lines, onClear }: ConsolePaneProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function handleCopy() {
    void navigator.clipboard.writeText(lines.map((l) => l.text).join(""));
  }

  return (
    <div className="flex min-w-55 flex-1 basis-2/5 flex-col bg-bg-console">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
        <span className="flex items-center gap-1.5">
          <SquareTerminal className="size-3.5" strokeWidth={2.25} />
          Console
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            title="Copy output to clipboard"
            onClick={handleCopy}
          >
            <Copy className="size-3.5" strokeWidth={2.25} />
          </button>
          <button
            className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            title="Clear console"
            onClick={onClear}
          >
            <Trash2 className="size-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <div ref={outputRef} className="flex-1 overflow-y-auto px-3.5 py-2.5 font-mono text-[13px] leading-[1.55]">
        {lines.map((line, i) => (
          <span
            key={i}
            className={cn("whitespace-pre-wrap break-words", {
              "text-foreground": line.stream === "stdout",
              "text-red": line.stream === "stderr" || line.stream === "error",
              "text-muted-foreground italic": line.stream === "system",
            })}
          >
            {line.text}
          </span>
        ))}
      </div>
    </div>
  );
}
