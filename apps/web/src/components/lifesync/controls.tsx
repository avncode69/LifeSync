"use client";

import { enUS, uk } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatControlDate as dateValue, parseControlDate as localDate } from "./control-values";
import { useLocale } from "./providers";

function optionsFrom(children: ReactNode): ComponentProps<"option">[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<ComponentProps<"option">>(child)) return [];
    return child.type === "option" ? [child.props] : optionsFrom(child.props.children);
  });
}

/** Keep the real form control for FormData, validation and existing change handlers. */
export function LifeSelect({
  children,
  className = "control",
  id,
  value,
  defaultValue,
  ...props
}: ComponentProps<"select">) {
  const { t } = useLocale();
  const errorId = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = optionsFrom(children);
  const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const [invalid, setInvalid] = useState(false);
  const selected = String(value ?? uncontrolled);
  useEffect(() => {
    const form = native.current?.form;
    const reset = () =>
      queueMicrotask(() => {
        if (native.current) setUncontrolled(native.current.value);
        setInvalid(false);
      });
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  return (
    <>
      <select
        {...props}
        ref={native}
        className="lifesync-form-control"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setUncontrolled(event.target.value);
          setInvalid(false);
          props.onChange?.(event);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          props.onInvalid?.(event);
        }}
      >
        {children}
      </select>
      <Select
        value={`option:${selected}`}
        disabled={props.disabled}
        onValueChange={(next) => {
          if (!native.current) return;
          native.current.value = next.slice(7);
          native.current.dispatchEvent(new Event("change", { bubbles: true }));
        }}
      >
        <SelectTrigger
          ref={trigger}
          id={id}
          className={`lifesync-select-trigger ${className}`}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={
            invalid ? [props["aria-describedby"], errorId].filter(Boolean).join(" ") : props["aria-describedby"]
          }
          aria-invalid={invalid || props["aria-invalid"]}
          aria-required={props.required}
          onBlur={
            props.onBlur
              ? () => native.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
              : undefined
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="lifesync-select-menu">
          {options.map((option) => (
            <SelectItem
              key={String(option.value ?? option.children)}
              value={`option:${String(option.value ?? option.children)}`}
              disabled={option.disabled}
              className="lifesync-select-option"
            >
              {option.children}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid && (
        <span id={errorId} role="alert" className="block text-xs text-destructive">
          {t("required")}
        </span>
      )}
    </>
  );
}

type DateControlProps = Omit<ComponentProps<"input">, "type"> & { type?: "date" | "datetime-local" };

/** Date-only and local date-time strings stay unchanged at the API boundary. */
export function LifeDateInput({
  className = "control",
  id,
  type = "date",
  value,
  defaultValue,
  ...props
}: DateControlProps) {
  const { locale, t } = useLocale();
  const timeId = useId();
  const native = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const current = String(value ?? uncontrolled);
  const selected = localDate(current);
  const withTime = type === "datetime-local";
  const time = current.slice(11, 16) || "00:00";
  const [hour, minute] = time.split(":");
  const labels =
    locale === "uk"
      ? { hour: "Години", minute: "Хвилини", clear: "Очистити", done: "Готово", today: "Сьогодні" }
      : { hour: "Hours", minute: "Minutes", clear: "Clear", done: "Done", today: "Today" };
  function change(next: string) {
    if (!native.current) return;
    // Bypass React's value tracker so its normal input event delivers a real ChangeEvent.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(native.current, next);
    native.current.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function pickDate(date: Date) {
    change(`${dateValue(date)}${withTime ? `T${time}` : ""}`);
    if (!withTime) setOpen(false);
  }
  useEffect(() => {
    const form = native.current?.form;
    const reset = () =>
      queueMicrotask(() => {
        if (native.current) setUncontrolled(native.current.value);
        setInvalid(false);
      });
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  const min = props.min ? localDate(String(props.min)) : undefined;
  const max = props.max ? localDate(String(props.max)) : undefined;
  return (
    <>
      <input
        {...props}
        type={type}
        ref={native}
        className="lifesync-form-control"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setUncontrolled(event.target.value);
          setInvalid(false);
          props.onChange?.(event);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          props.onInvalid?.(event);
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={trigger}
            type="button"
            id={id}
            disabled={props.disabled || props.readOnly}
            className={`lifesync-date-trigger ${className}`}
            aria-label={props["aria-label"]}
            aria-labelledby={props["aria-labelledby"]}
            aria-describedby={props["aria-describedby"]}
            aria-invalid={invalid || props["aria-invalid"]}
          >
            <span>
              {selected
                ? `${new Intl.DateTimeFormat(locale).format(selected)}${withTime ? `, ${time}` : ""}`
                : props.placeholder || t("date")}
            </span>
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="lifesync-date-menu">
          <Calendar
            mode="single"
            locale={locale === "uk" ? uk : enUS}
            selected={selected}
            defaultMonth={selected}
            autoFocus
            disabled={(date) => !!((min && date < min) || (max && date > max))}
            onSelect={(date) => {
              if (date) pickDate(date);
            }}
            className="lifesync-calendar"
          />
          {withTime && (
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <label htmlFor={`${timeId}-hour`} className="space-y-1 text-xs text-muted-foreground">
                <span>{labels.hour}</span>
                <LifeSelect
                  id={`${timeId}-hour`}
                  value={hour}
                  aria-label={labels.hour}
                  onChange={(event) => change(`${dateValue(selected ?? new Date())}T${event.target.value}:${minute}`)}
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </LifeSelect>
              </label>
              <label htmlFor={`${timeId}-minute`} className="space-y-1 text-xs text-muted-foreground">
                <span>{labels.minute}</span>
                <LifeSelect
                  id={`${timeId}-minute`}
                  value={minute}
                  aria-label={labels.minute}
                  onChange={(event) => change(`${dateValue(selected ?? new Date())}T${hour}:${event.target.value}`)}
                >
                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </LifeSelect>
              </label>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
            <button
              type="button"
              className="lifesync-picker-action"
              onClick={() => {
                change("");
                setOpen(false);
              }}
            >
              {labels.clear}
            </button>
            <button
              type="button"
              className="lifesync-picker-action"
              onClick={() => pickDate(new Date())}
              disabled={
                !!(
                  (min && new Date().setHours(0, 0, 0, 0) < min.getTime()) ||
                  (max && new Date().setHours(0, 0, 0, 0) > max.getTime())
                )
              }
            >
              {labels.today}
            </button>
            {withTime && (
              <button type="button" className="lifesync-picker-action" onClick={() => setOpen(false)}>
                {labels.done}
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {invalid && (
        <span role="alert" className="block text-xs text-destructive">
          {t("required")}
        </span>
      )}
    </>
  );
}
