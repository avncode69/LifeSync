"use client";
import { useLocale } from "./providers";

const presets = {
  none: "",
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};
export function RecurrenceInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (rule: string) => void;
  disabled: boolean;
}) {
  const { t, locale } = useLocale();
  const selected = Object.entries(presets).find(([, rule]) => rule === value)?.[0] ?? "customInterval";
  const frequency = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(value)?.[1] ?? "WEEKLY";
  const interval = Number(/INTERVAL=(\d+)/.exec(value)?.[1] ?? 1);
  const weekdays = /BYDAY=([^;]+)/.exec(value)?.[1].split(",") ?? [];
  function custom(freq: string, every: number, days: string[]) {
    onChange(`FREQ=${freq};INTERVAL=${every}${freq === "WEEKLY" && days.length ? `;BYDAY=${days.join(",")}` : ""}`);
  }
  return (
    <div className="space-y-3">
      <select
        id="field-recurrenceRule"
        className="control"
        disabled={disabled}
        value={selected}
        onChange={(event) =>
          onChange(
            event.target.value === "customInterval"
              ? "FREQ=WEEKLY;INTERVAL=1"
              : presets[event.target.value as keyof typeof presets],
          )
        }
      >
        {[...Object.keys(presets), "customInterval"].map((key) => (
          <option key={key} value={key}>
            {t(key)}
          </option>
        ))}
      </select>
      {selected === "customInterval" && (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex gap-2">
            <input
              className="control w-24"
              type="number"
              min={1}
              max={365}
              aria-label={t("interval")}
              value={interval}
              disabled={disabled}
              onChange={(event) => custom(frequency, Number(event.target.value), weekdays)}
            />
            <select
              className="control"
              value={frequency}
              disabled={disabled}
              aria-label={t("frequency")}
              onChange={(event) => custom(event.target.value, interval, weekdays)}
            >
              {["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map((key) => (
                <option key={key} value={key}>
                  {t(key.toLowerCase())}
                </option>
              ))}
            </select>
          </div>
          {frequency === "WEEKLY" && (
            <div className="flex flex-wrap gap-2">
              {["MO", "TU", "WE", "TH", "FR", "SA", "SU"].map((day, index) => (
                <label key={day} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={weekdays.includes(day)}
                    onChange={(event) =>
                      custom(
                        frequency,
                        interval,
                        event.target.checked ? [...weekdays, day] : weekdays.filter((value) => value !== day),
                      )
                    }
                  />
                  {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, index + 1))}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
