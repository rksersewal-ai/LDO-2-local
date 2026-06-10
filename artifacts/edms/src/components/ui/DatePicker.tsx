import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(value: string): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  required?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  label,
  className = "",
  minDate,
  maxDate,
  disabled = false,
  required = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"day" | "month" | "year">("day");
  const [viewDate, setViewDate] = useState<Date>(() => parseDate(value) ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      if (d) setViewDate(d);
    }
  }, [value]);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 288; // w-72 is 18rem = 288px
      let left = rect.left + window.scrollX;
      // Prevent popover going off-screen to the right
      if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) left = 16;

      setCoords({
        top: rect.bottom + window.scrollY,
        left,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      // Listen to resize & scroll events to keep popover aligned
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        // Do not close if clicking inside the portal-rendered dropdown
        !(e.target as HTMLElement).closest(".datepicker-portal-popover")
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minD = minDate ? parseDate(minDate) : null;
  const maxD = maxDate ? parseDate(maxDate) : null;

  const isDisabledDate = (d: Date) => {
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDay = (day: number) => {
    const d = new Date(year, month, day);
    if (isDisabledDate(d)) return;
    onChange(toIsoDate(d));
    setOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevYear = () => setViewDate(new Date(year - 1, month, 1));
  const nextYear = () => setViewDate(new Date(year + 1, month, 1));

  const yearRange = Array.from({ length: 12 }, (_, i) => year - 5 + i);

  const dropdownPopover = open && (
    <div
      role="dialog"
      aria-label={label ?? placeholder}
      className="datepicker-portal-popover absolute z-[99999] mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-md"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
        {view === "day" && (
          <>
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-primary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setView("month")}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 hover:text-primary"
              >
                {MONTHS[month]}
              </button>
              <button
                type="button"
                onClick={() => setView("year")}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 hover:text-primary"
              >
                {year}
              </button>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-primary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {view === "month" && (
          <>
            <button
              type="button"
              onClick={prevYear}
              className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-primary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("year")}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 hover:text-primary"
            >
              {year}
            </button>
            <button
              type="button"
              onClick={nextYear}
              className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-primary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {view === "year" && (
          <>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year - 12, month, 1))}
              className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-primary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {yearRange[0]} – {yearRange[11]}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year + 12, month, 1))}
              className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-primary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Day view */}
      {view === "day" && (
        <div className="p-3.5">
          <div className="mb-2 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Selected
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {value ? formatDisplay(value) : "No date selected"}
              </p>
            </div>
            <div className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              {MONTHS[month].slice(0, 3)}
            </div>
          </div>
          <div className="mb-1 grid grid-cols-7">
            {DAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const d = new Date(year, month, day);
              d.setHours(0, 0, 0, 0);
              const isToday = d.getTime() === today.getTime();
              const isSel = selected && d.getTime() === selected.getTime();
              const isOff = isDisabledDate(d);
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => selectDay(day)}
                  disabled={isOff}
                  className={`h-9 w-full rounded-xl text-xs font-semibold tabular-nums transition-all ${
                    isSel
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : isToday
                        ? "border border-primary/45 bg-primary/10 text-primary"
                        : isOff
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-foreground/90 hover:bg-secondary hover:text-primary"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                onChange(toIsoDate(t));
                setOpen(false);
              }}
              className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/15"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/30 hover:text-destructive"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Month view */}
      {view === "month" && (
        <div className="grid grid-cols-3 gap-1.5 p-3.5">
          {MONTHS.map((m, i) => (
            <button
              type="button"
              key={m}
              onClick={() => {
                setViewDate(new Date(year, i, 1));
                setView("day");
              }}
              className={`rounded-xl py-2.5 text-xs font-semibold transition-all ${
                i === month
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-foreground/90 hover:bg-secondary hover:text-primary"
              }`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {/* Year view */}
      {view === "year" && (
        <div className="grid grid-cols-3 gap-1.5 p-3.5">
          {yearRange.map((y) => (
            <button
              type="button"
              key={y}
              onClick={() => {
                setViewDate(new Date(y, month, 1));
                setView("month");
              }}
              className={`rounded-xl py-2.5 text-xs font-semibold tabular-nums transition-all ${
                y === year
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-foreground/90 hover:bg-secondary hover:text-primary"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {label}
          {required && <span className="ml-1 text-rose-400">*</span>}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o);
            setView("day");
          }
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`w-full flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-sm tabular-nums transition-all ${
          disabled
            ? "bg-secondary/20 border-border/40 text-muted-foreground/50 cursor-not-allowed"
            : open
              ? "bg-secondary/60 border-primary ring-1 ring-primary/30 shadow-md shadow-primary/10 text-foreground"
              : "bg-secondary/30 border-border/80 text-foreground hover:border-primary/40 hover:bg-secondary/50"
        }`}
      >
        <Calendar
          className={`w-4 h-4 shrink-0 ${value ? "text-primary" : "text-muted-foreground"}`}
        />
        <span className={`flex-1 ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && !disabled && (
          <X
            className="w-3.5 h-3.5 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setOpen(false);
            }}
          />
        )}
      </button>

      {open && createPortal(dropdownPopover, document.body)}
    </div>
  );
}
