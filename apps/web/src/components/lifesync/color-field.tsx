"use client";

import { Check, ChevronDown, Palette } from "lucide-react";
import { type ComponentProps, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hexColor } from "@/lib/color-value";
import { useLocale } from "./providers";

// Stored HEX values correspond to these named Tailwind palette colors.
const colors = [
  { label: "colorViolet", value: "#8B5CF6", className: "bg-violet-500" },
  { label: "colorBlue", value: "#3B82F6", className: "bg-blue-500" },
  { label: "colorCyan", value: "#06B6D4", className: "bg-cyan-500" },
  { label: "colorTeal", value: "#14B8A6", className: "bg-teal-500" },
  { label: "colorGreen", value: "#22C55E", className: "bg-green-500" },
  { label: "colorAmber", value: "#F59E0B", className: "bg-amber-500" },
  { label: "colorOrange", value: "#F97316", className: "bg-orange-500" },
  { label: "colorRose", value: "#F43F5E", className: "bg-rose-500" },
  { label: "colorPink", value: "#EC4899", className: "bg-pink-500" },
  { label: "colorSlate", value: "#64748B", className: "bg-slate-500" },
];

type ColorFieldProps = Pick<
  ComponentProps<"button">,
  "id" | "disabled" | "aria-invalid" | "aria-describedby" | "className"
> & { value: string; onChange: (value: string) => void };

export function ColorField({ value, onChange, className = "control", ...props }: ColorFieldProps) {
  const { t } = useLocale();
  const customId = useId();
  const [open, setOpen] = useState(false);
  const selected = hexColor(value);
  const invalid = !!value && !selected;
  const preset = colors.find((color) => color.value === selected);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          {...props}
          type="button"
          className={`${className} flex items-center gap-2.5 text-left`}
          aria-invalid={invalid || props["aria-invalid"]}
        >
          <span
            aria-hidden="true"
            className={`flex size-6 shrink-0 items-center justify-center rounded-md border border-foreground/15 ${selected ? "" : "bg-muted text-muted-foreground"}`}
            style={selected ? { backgroundColor: selected } : undefined}
          >
            {!selected && <Palette className="size-3.5" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            {preset ? t(preset.label) : selected || t("chooseColor")}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="lifesync-color-menu w-72 max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl"
      >
        <p className="text-sm font-semibold">{t("colorPalette")}</p>
        <fieldset disabled={props.disabled} aria-label={t("colorPalette")} className="grid grid-cols-5 gap-2">
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              aria-label={`${t(color.label)} · ${color.value}`}
              title={t(color.label)}
              aria-pressed={selected === color.value}
              className={`flex size-10 items-center justify-center rounded-xl border border-foreground/10 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${color.className} ${selected === color.value ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : ""}`}
              onClick={() => {
                onChange(color.value);
                setOpen(false);
              }}
            >
              {selected === color.value && <Check aria-hidden="true" className="size-5 text-white drop-shadow" />}
            </button>
          ))}
        </fieldset>
        <div className="mt-2 space-y-2 border-t pt-3">
          <label htmlFor={customId} className="block text-xs font-medium">
            {t("customColor")}
          </label>
          <input
            id={customId}
            type="text"
            className="control font-mono uppercase"
            value={value}
            placeholder="#8B5CF6"
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            disabled={props.disabled}
            aria-invalid={invalid}
            aria-describedby={`${customId}-hint`}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
          />
          <p id={`${customId}-hint`} className={`text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
            {t("colorHexHint")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
