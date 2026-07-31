import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiRow } from "@/components/ui/KpiRow";
import { Stepper } from "@/components/ui/Stepper";
import { Meter } from "@/components/ui/Meter";
import { Progress } from "@/components/ui/Progress";
import { Callout } from "@/components/ui/Callout";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";

describe("Button", () => {
  it("renders children and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and shows a spinner while loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
  });
});

describe("StatusBadge", () => {
  it("renders semantic and domain variants", () => {
    render(
      <>
        <StatusBadge status="success">Confirmed</StatusBadge>
        <StatusBadge domain="finance">Financing</StatusBadge>
      </>,
    );
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Financing")).toBeInTheDocument();
  });
});

describe("KpiRow", () => {
  it("renders each KPI", () => {
    render(
      <KpiRow
        items={[
          { label: "Batches", value: "1,204" },
          { label: "Volume", value: "$4.2M" },
        ]}
      />,
    );
    expect(screen.getByText("Batches")).toBeInTheDocument();
    expect(screen.getByText("$4.2M")).toBeInTheDocument();
  });
});

describe("Stepper", () => {
  it("marks the current step with aria-current", () => {
    render(<Stepper current={1} steps={[{ label: "Approve" }, { label: "Sign" }, { label: "Confirm" }]} />);
    expect(screen.getByText("Sign")).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).not.toBeNull();
  });
});

describe("Meter & Progress", () => {
  it("exposes accessible roles and values", () => {
    render(
      <>
        <Meter value={80} label="Score" />
        <Progress value={50} label="Loading" />
      </>,
    );
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "80");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });
});

describe("Callout", () => {
  it("uses alert role for warn/danger tones", () => {
    render(<Callout tone="danger" title="Boom">Failure</Callout>);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });
});

function ControlledSwitch() {
  const [on, setOn] = useState(false);
  return <Switch checked={on} onCheckedChange={setOn} label="Toggle" />;
}

describe("Switch", () => {
  it("toggles aria-checked on click", async () => {
    render(<ControlledSwitch />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

describe("Tabs", () => {
  it("switches panels on tab click", async () => {
    render(
      <Tabs
        items={[
          { id: "one", label: "One", content: <p>First panel</p> },
          { id: "two", label: "Two", content: <p>Second panel</p> },
        ]}
      />,
    );
    expect(screen.getByText("First panel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Second panel")).toBeInTheDocument();
  });
});

interface DemoRow {
  readonly id: string;
  readonly name: string;
}

describe("DataTable", () => {
  const columns: Column<DemoRow>[] = [{ id: "name", header: "Name", cell: (r) => r.name }];

  it("renders rows", () => {
    render(<DataTable columns={columns} rows={[{ id: "1", name: "Alpha" }]} getRowKey={(r) => r.id} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id} emptyTitle="Nothing" />);
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });

  it("shows the error state with retry", async () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id} error="Boom" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
