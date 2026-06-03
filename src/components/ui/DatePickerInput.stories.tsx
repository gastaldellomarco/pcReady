import { expect, fn, userEvent, within } from "@storybook/test";
import { DatePickerInput } from "./date-picker-input";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof DatePickerInput> = {
  title: "UI/DatePickerInput",
  component: DatePickerInput,
  tags: ["autodocs"],
  args: {
    value: "",
    onChange: fn(),
    disabled: false,
    placeholder: "dd/mm/yyyy",
    required: false,
  },
  argTypes: {
    value: {
      control: "text",
      description: "ISO date string (YYYY-MM-DD)",
      table: { type: { summary: "string" } },
    },
    onChange: {
      action: "changed",
      description: "Called with an ISO date string (YYYY-MM-DD) when the user selects a date, or an empty string when cleared",
    },
    disabled: {
      control: "boolean",
      description: "Disables the trigger button",
    },
    className: {
      control: "text",
      description: "Additional CSS class names",
    },
    placeholder: {
      control: "text",
      description: "Text displayed when no date is selected",
    },
    id: {
      control: "text",
      description: "HTML id attribute on the trigger button",
    },
    minDate: {
      control: "text",
      description: "Earliest selectable date (ISO string YYYY-MM-DD)",
      table: { type: { summary: "string" } },
    },
    maxDate: {
      control: "text",
      description: "Latest selectable date (ISO string YYYY-MM-DD)",
      table: { type: { summary: "string" } },
    },
    required: {
      control: "boolean",
      description: "Adds aria-required to the trigger",
    },
    onBlur: {
      action: "blurred",
      description: "Called when the trigger button loses focus",
    },
    title: {
      control: "text",
      description: "Native HTML title attribute (tooltip)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DatePickerInput>;

// ── Empty ────────────────────────────────────────────────────────────

export const Empty: Story = {
  args: {
    value: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Should show placeholder when empty
    const trigger = canvas.getByRole("button", { name: "dd/mm/yyyy" });
    await expect(trigger).toBeVisible();
    await expect(trigger).not.toHaveAttribute("aria-required");
  },
};

// ── With Value ───────────────────────────────────────────────────────

export const WithValue: Story = {
  args: {
    value: "2026-05-27",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Should format the date in Italian locale
    const trigger = canvas.getByRole("button", { name: "27/05/2026" });
    await expect(trigger).toBeVisible();
    // Clear button (X) should be present
    await expect(canvas.getByRole("button", { name: "Cancella data" })).toBeVisible();
  },
};

// ── Disabled ─────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: {
    value: "2026-05-27",
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "27/05/2026" });
    await expect(trigger).toBeDisabled();
    // Clear button should NOT be visible when disabled
    await expect(canvas.queryByRole("button", { name: "Cancella data" })).toBeNull();
  },
};

// ── Disabled Empty ───────────────────────────────────────────────────

export const DisabledEmpty: Story = {
  args: {
    value: "",
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "dd/mm/yyyy" });
    await expect(trigger).toBeDisabled();
  },
};

// ── Required ─────────────────────────────────────────────────────────

export const Required: Story = {
  args: {
    value: "",
    required: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "dd/mm/yyyy" });
    await expect(trigger).toHaveAttribute("aria-required", "true");
  },
};

// ── Custom Placeholder ───────────────────────────────────────────────

export const CustomPlaceholder: Story = {
  args: {
    value: "",
    placeholder: "Seleziona una data...",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Seleziona una data..." })).toBeVisible();
  },
};

// ── Min Date ─────────────────────────────────────────────────────────

export const MinDateRestriction: Story = {
  args: {
    value: "",
    placeholder: "Data intervento",
    minDate: "2026-05-20",
  },
};

// ── Max Date ─────────────────────────────────────────────────────────

export const MaxDateRestriction: Story = {
  args: {
    value: "",
    placeholder: "Data scadenza",
    maxDate: "2026-12-31",
  },
};

// ── Min + Max Date Range ─────────────────────────────────────────────

export const DateRangeRestriction: Story = {
  args: {
    value: "2026-06-15",
    minDate: "2026-05-01",
    maxDate: "2026-08-31",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "15/06/2026" })).toBeVisible();
  },
};

// ── With ID ──────────────────────────────────────────────────────────

export const WithId: Story = {
  args: {
    value: "",
    id: "my-date-field",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "dd/mm/yyyy" });
    await expect(trigger).toHaveAttribute("id", "my-date-field");
  },
};

// ── With Title ───────────────────────────────────────────────────────

export const WithTitle: Story = {
  args: {
    value: "",
    title: "Seleziona la data di inizio",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "dd/mm/yyyy" });
    await expect(trigger).toHaveAttribute("title", "Seleziona la data di inizio");
  },
};

// ── Custom ClassName ─────────────────────────────────────────────────

export const CustomClassName: Story = {
  args: {
    value: "",
    className: "max-w-[200px]",
    placeholder: "Filtra per data",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Filtra per data" });
    await expect(trigger).toHaveClass("max-w-[200px]");
  },
};

// ── Filter Field Use Case ────────────────────────────────────────────

export const FilterField: Story = {
  args: {
    value: "2026-05-01",
    placeholder: "Data inizio",
    className: "w-36",
    minDate: "2026-01-01",
    maxDate: "2026-12-31",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "01/05/2026" })).toBeVisible();
    // Press the clear button
    const clearBtn = canvas.getByRole("button", { name: "Cancella data" });
    await userEvent.click(clearBtn);
    await expect(args.onChange).toHaveBeenCalledWith("");
  },
};

// ── Both light and dark stacked ──────────────────────────────────────

export const LightAndDark: Story = {
  args: {
    value: "2026-05-27",
  },
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ marginBottom: 8, fontSize: 13, color: "var(--text2)" }}>Light</p>
        <DatePickerInput {...args} />
      </div>
      <div className="dark" style={{ background: "var(--page-surface)", padding: 20, borderRadius: 12 }}>
        <p style={{ marginBottom: 8, fontSize: 13, color: "var(--text2)" }}>Dark</p>
        <DatePickerInput {...args} />
      </div>
    </div>
  ),
};

// ── OnBlur ───────────────────────────────────────────────────────────

export const OnBlur: Story = {
  args: {
    value: "",
    onBlur: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "dd/mm/yyyy" });
    trigger.focus();
    trigger.blur();
    await expect(args.onBlur).toHaveBeenCalled();
  },
};

// ── Playground ───────────────────────────────────────────────────────

export const Playground: Story = {
  args: {
    value: "",
    placeholder: "dd/mm/yyyy",
    disabled: false,
    required: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    await expect(trigger).toBeVisible();
  },
};
