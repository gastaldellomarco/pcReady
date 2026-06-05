// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock lucide-react icons ─────────────────────────────────────────────
vi.mock("lucide-react", () => ({
  CalendarIcon: (props: Record<string, unknown>) => <span data-testid="calendar-icon" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props} />,
}));

// ── Mock Popover (Radix) ────────────────────────────────────────────────
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

// ── Mock Calendar (react-day-picker) ─────────────────────────────────────
vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
    disabled: disabledFn,
  }: {
    mode: string;
    selected?: Date;
    onSelect?: (d: Date | undefined) => void;
    defaultMonth?: Date;
    disabled?: (d: Date) => boolean;
  }) => (
    <div data-testid="calendar">
      <button
        data-testid="date-2026-05-20"
        onClick={() => onSelect?.(new Date("2026-05-20T00:00:00Z"))}
        disabled={disabledFn?.(new Date("2026-05-20T00:00:00Z"))}
      >
        2026-05-20
      </button>
      <button
        data-testid="date-2026-06-10"
        onClick={() => onSelect?.(new Date("2026-06-10T00:00:00Z"))}
        disabled={disabledFn?.(new Date("2026-06-10T00:00:00Z"))}
      >
        2026-06-10
      </button>
      <button
        data-testid="date-2025-01-01"
        onClick={() => onSelect?.(new Date("2025-01-01T00:00:00Z"))}
        disabled={disabledFn?.(new Date("2025-01-01T00:00:00Z"))}
      >
        2025-01-01
      </button>
    </div>
  ),
}));

// ── Mock cn utility ─────────────────────────────────────────────────────
vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(" "),
}));

// ── Mock date-fns (use real functions but verify calls) ─────────────────
// date-fns functions are pure, so we use the real implementations

// Import after mocks
import { DatePickerInput } from "@/components/ui/date-picker-input";

describe("DatePickerInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ─────────────────────────────────────────────────────────

  it("renders with placeholder when no value is provided", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} placeholder="dd/mm/yyyy" />);

    expect(screen.getByText("dd/mm/yyyy")).toBeTruthy();
  });

  it("renders formatted date when value is provided", () => {
    render(<DatePickerInput value="2026-05-27" onChange={vi.fn()} />);

    // Italian format: dd/MM/yyyy → 27/05/2026
    expect(screen.getByText("27/05/2026")).toBeTruthy();
  });

  it("renders custom placeholder text", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} placeholder="Seleziona data" />);

    expect(screen.getByText("Seleziona data")).toBeTruthy();
  });

  // ── Empty / edge-case values ──────────────────────────────────────────

  it("handles empty string value gracefully (shows placeholder)", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} />);

    expect(screen.getByText("dd/mm/yyyy")).toBeTruthy();
    expect(screen.queryByTestId("x-icon")).toBeNull();
  });

  it("handles invalid date string gracefully by displaying it as-is", () => {
    render(<DatePickerInput value="not-a-date" onChange={vi.fn()} />);

    // fmtDate catches parseISO errors and returns the raw value
    expect(screen.getByText("not-a-date")).toBeTruthy();
  });

  // ── Clear button ──────────────────────────────────────────────────────

  it("shows X clear button when value is present", () => {
    render(<DatePickerInput value="2026-05-27" onChange={vi.fn()} />);

    expect(screen.getByTestId("x-icon")).toBeTruthy();
  });

  it("calls onChange with empty string when clear button is clicked", async () => {
    const onChange = vi.fn();
    render(<DatePickerInput value="2026-05-27" onChange={onChange} />);

    const clearBtn = screen.getByRole("button", { name: "Cancella data" });
    await userEvent.click(clearBtn);

    expect(onChange).toHaveBeenCalledWith("");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("clear button click does not propagate (stops popover from opening)", async () => {
    const onChange = vi.fn();
    render(<DatePickerInput value="2026-05-27" onChange={onChange} />);

    const clearBtn = screen.getByRole("button", { name: "Cancella data" });

    // Simulate a click that would also trigger the popover trigger
    // stopPropagation should prevent this
    await userEvent.click(clearBtn);

    // onChange should only be called once (with ""), not also from popover opening
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("hides clear button when disabled even with a value", () => {
    render(<DatePickerInput value="2026-05-27" onChange={vi.fn()} disabled />);

    expect(screen.queryByTestId("x-icon")).toBeNull();
  });

  it("hides clear button when value is empty", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} />);

    expect(screen.queryByTestId("x-icon")).toBeNull();
  });

  it("clear button is keyboard-accessible via Enter and Space", () => {
    const onChange = vi.fn();
    render(<DatePickerInput value="2026-05-27" onChange={onChange} />);

    const clearBtn = screen.getByRole("button", { name: "Cancella data" });

    // Simulate Enter keyDown + click (browser fires click on Enter for buttons)
    fireEvent.keyDown(clearBtn, { key: "Enter", code: "Enter" });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");

    // Reset and test Space triggers click without double-fire
    onChange.mockClear();

    fireEvent.keyDown(clearBtn, { key: " ", code: "Space" });
    fireEvent.click(clearBtn);

    // onChange should fire exactly once via onClick (onKeyDown only prevents scroll)
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });

  // ── Disabled state ────────────────────────────────────────────────────

  it("disables the trigger button when disabled prop is true", () => {
    render(<DatePickerInput value="2026-05-27" onChange={vi.fn()} disabled />);

    const button = screen.getByRole("button", { name: /27\/05\/2026/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("has no aria-required when required is not set", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} />);

    const button = screen.getByRole("button", { name: "dd/mm/yyyy" });
    expect(button.getAttribute("aria-required")).toBeNull();
  });

  // ── Required prop ─────────────────────────────────────────────────────

  it("sets aria-required on button when required is true", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} required />);

    const button = screen.getByRole("button", { name: "dd/mm/yyyy" });
    expect(button.getAttribute("aria-required")).toBe("true");
  });

  // ── Calendar date selection ───────────────────────────────────────────

  it("opens popover and calls onChange when a date is selected", async () => {
    const onChange = vi.fn();
    render(<DatePickerInput value="" onChange={onChange} />);

    // Click the trigger button to open popover (it's always visible in our mock)
    const trigger = screen.getByRole("button", { name: "dd/mm/yyyy" });
    await userEvent.click(trigger);

    // Select a date from the calendar
    const dateBtn = screen.getByTestId("date-2026-05-20");
    await userEvent.click(dateBtn);

    expect(onChange).toHaveBeenCalledWith("2026-05-20");
  });

  it("calls onChange with correct ISO format after date selection", async () => {
    const onChange = vi.fn();
    render(<DatePickerInput value="" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "dd/mm/yyyy" });
    await userEvent.click(trigger);

    await userEvent.click(screen.getByTestId("date-2026-06-10"));

    expect(onChange).toHaveBeenCalledWith("2026-06-10");
  });

  // ── minDate / maxDate ─────────────────────────────────────────────────

  it("respects minDate: dates before minDate are disabled", async () => {
    render(<DatePickerInput value="" onChange={vi.fn()} minDate="2026-01-01" />);

    // Click trigger to render calendar
    const trigger = screen.getByRole("button", { name: "dd/mm/yyyy" });
    await userEvent.click(trigger);

    // Date 2025-01-01 is before minDate, should be disabled
    const earlyDate = screen.getByTestId("date-2025-01-01");
    expect((earlyDate as HTMLButtonElement).disabled).toBe(true);
  });

  it("allows dates within minDate/maxDate range", async () => {
    render(
      <DatePickerInput value="" onChange={vi.fn()} minDate="2026-05-01" maxDate="2026-06-01" />,
    );

    const trigger = screen.getByRole("button", { name: "dd/mm/yyyy" });
    await userEvent.click(trigger);

    // 2026-05-20 is within range → enabled
    const inRange = screen.getByTestId("date-2026-05-20");
    expect((inRange as HTMLButtonElement).disabled).toBe(false);

    // 2026-06-10 is after maxDate → disabled
    const outOfRange = screen.getByTestId("date-2026-06-10");
    expect((outOfRange as HTMLButtonElement).disabled).toBe(true);
  });

  // ── HTML attributes passthrough ───────────────────────────────────────

  it("passes id attribute to the trigger button", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} id="my-date-input" />);

    const button = screen.getByRole("button", { name: "dd/mm/yyyy" });
    expect(button.id).toBe("my-date-input");
  });

  it("passes title attribute to the trigger button", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} title="Data inizio" />);

    const button = screen.getByRole("button", { name: "dd/mm/yyyy" });
    expect(button.title).toBe("Data inizio");
  });

  it("passes className to the trigger button", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} className="custom-class" />);

    const button = screen.getByRole("button", { name: "dd/mm/yyyy" });
    expect(button.className).toContain("custom-class");
  });

  // ── onBlur ────────────────────────────────────────────────────────────

  it("calls onBlur when the trigger button loses focus", async () => {
    const onBlur = vi.fn();
    render(<DatePickerInput value="" onChange={vi.fn()} onBlur={onBlur} />);

    const button = screen.getByRole("button", { name: "dd/mm/yyyy" });
    button.focus();
    button.blur();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  // ── CalendarIcon always visible ───────────────────────────────────────

  it("always renders the calendar icon", () => {
    render(<DatePickerInput value="" onChange={vi.fn()} />);

    expect(screen.getByTestId("calendar-icon")).toBeTruthy();
  });

  it("renders calendar icon even when a value is set", () => {
    render(<DatePickerInput value="2026-05-27" onChange={vi.fn()} />);

    expect(screen.getByTestId("calendar-icon")).toBeTruthy();
  });
});
