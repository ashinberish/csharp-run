import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIN_FILE, type SessionFile } from "@/lib/session";

interface TabStripProps {
  files: SessionFile[];
  activeFile: string;
  onSelect: (name: string) => void;
  onClose: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

export function TabStrip({ files, activeFile, onSelect, onClose, onRename }: TabStripProps) {
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <div className="flex h-[34px] shrink-0 items-end gap-1 overflow-x-auto overflow-y-hidden border-b border-border bg-card px-2.5">
      {files.map((file) => (
        <Tab
          key={file.name}
          file={file}
          active={file.name === activeFile}
          renaming={renaming === file.name}
          onSelect={() => onSelect(file.name)}
          onClose={() => onClose(file.name)}
          onStartRename={() => setRenaming(file.name)}
          onFinishRename={(newName) => {
            setRenaming(null);
            if (newName && newName !== file.name) onRename(file.name, newName);
          }}
        />
      ))}
    </div>
  );
}

interface TabProps {
  file: SessionFile;
  active: boolean;
  renaming: boolean;
  onSelect: () => void;
  onClose: () => void;
  onStartRename: () => void;
  onFinishRename: (newName: string) => void;
}

function Tab({ file, active, renaming, onSelect, onClose, onStartRename, onFinishRename }: TabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closable = file.name !== MAIN_FILE;

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  return (
    <div
      className={cn(
        "group relative flex h-[34px] shrink-0 cursor-pointer items-center gap-2 rounded-t-md border border-transparent border-b-0 py-0 pr-2.5 pl-3.5 font-mono text-[12.5px] text-muted-foreground",
        active ? "border-border bg-muted text-foreground" : "hover:bg-accent hover:text-foreground",
      )}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartRename();
      }}
    >
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-t-sm bg-gradient-to-r from-blue to-yellow" />
      )}
      <span
        className="size-1.5 shrink-0 rounded-full bg-yellow transition-opacity"
        style={{ opacity: file.dirty ? 1 : 0 }}
      />
      {renaming ? (
        <input
          ref={inputRef}
          defaultValue={file.name}
          className="w-[130px] rounded-sm border border-blue bg-background px-1 py-px font-mono text-[12.5px] text-foreground outline-none"
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => onFinishRename(e.currentTarget.value.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") onFinishRename("");
          }}
        />
      ) : (
        <span className="max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{file.name}</span>
      )}
      {closable && (
        <button
          className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          title="Close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
