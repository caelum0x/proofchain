"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  IconButton,
  Badge,
  StatusBadge,
  Tag,
  Avatar,
  AddressBadge,
  Input,
  Textarea,
  Select,
  Combobox,
  Checkbox,
  Switch,
  RadioGroup,
  Slider,
  Field,
  Tooltip,
  Popover,
  Dropdown,
  Tabs,
  Accordion,
  Dialog,
  Drawer,
  toast,
  Spinner,
  Skeleton,
  SkeletonText,
  Progress,
  Meter,
  Callout,
  EmptyState,
  Breadcrumbs,
  Pagination,
  Stepper,
  Card,
  CardHeader,
  Divider,
  CodeBlock,
  CopyButton,
  JsonViewer,
  DataTable,
  CardGrid,
  StatCard,
  KpiRow,
  Timeline,
  Sparkline,
  LineChart,
  AreaChart,
  BarChart,
  DonutChart,
  MapPreview,
  FileDropzone,
  type Column,
} from "@/components/ui";
import { PageHeader, Toolbar, FilterBar, ViewToggle, type ViewMode } from "@/components/page";

interface Row {
  readonly id: string;
  readonly name: string;
  readonly value: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Batch A", value: 42 },
  { id: "2", name: "Batch B", value: 17 },
  { id: "3", name: "Batch C", value: 88 },
];

const COLUMNS: Column<Row>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, sortable: true },
  { id: "value", header: "Value", cell: (r) => <span className="font-mono">{r.value}</span>, align: "right", sortable: true },
];

const SERIES = [4, 8, 6, 12, 9, 16, 11, 20].map((y, x) => ({ x, y }));

/**
 * Dev-only component gallery (WD §8) — a living showcase of every design-system
 * primitive so page teams can see conventions and copy usage.
 */
export default function SystemGalleryPage() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("a");
  const [slider, setSlider] = useState(40);
  const [combo, setCombo] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Design System Gallery"
        subtitle="Every ProofChain primitive, token, shell, and page component in one place."
        icon="dashboard"
        breadcrumbs={[{ label: "System", href: "/system" }, { label: "Gallery" }]}
        actions={<Button onClick={() => toast.success("Hello from the toast system")}>Fire toast</Button>}
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button size="sm">Small</Button>
          <IconButton icon="plus" label="Add" />
          <IconButton icon="settings" label="Settings" variant="ghost" />
        </div>
      </Section>

      <Section title="Badges & identity">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warn">Warn</Badge>
          <StatusBadge status="success">Confirmed</StatusBadge>
          <StatusBadge status="danger">Failed</StatusBadge>
          <StatusBadge domain="dpp">Passport</StatusBadge>
          <StatusBadge domain="finance">Financing</StatusBadge>
          <Tag onRemove={() => undefined}>filter: active</Tag>
          <Avatar seed="0xabc" label="Acme Co" />
          <AddressBadge address="0x1234567890abcdef1234567890abcdef12345678" />
        </div>
      </Section>

      <Section title="Inputs & forms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Text input" htmlFor="g-input" hint="A standard input.">
            <Input id="g-input" placeholder="Type something…" />
          </Field>
          <Field label="Select" htmlFor="g-select">
            <Select
              id="g-select"
              placeholder="Choose…"
              options={[
                { value: "a", label: "Option A" },
                { value: "b", label: "Option B" },
              ]}
            />
          </Field>
          <Field label="Combobox" htmlFor="g-combo">
            <Combobox
              id="g-combo"
              value={combo}
              onValueChange={setCombo}
              options={[
                { value: "eth", label: "Ethereum", hint: "ETH" },
                { value: "base", label: "Base", hint: "BASE" },
                { value: "op", label: "Optimism", hint: "OP" },
              ]}
            />
          </Field>
          <Field label="Textarea" htmlFor="g-textarea">
            <Textarea id="g-textarea" placeholder="Longer text…" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Checkbox id="g-check" label="Accept terms" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <Switch checked={checked} onCheckedChange={setChecked} label="Notifications" />
          <div className="w-48">
            <Slider min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))} showValue />
          </div>
        </div>
        <div className="mt-4 max-w-sm">
          <RadioGroup
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: "a", label: "Standard", description: "Default settlement" },
              { value: "b", label: "Express", description: "Priority settlement" },
            ]}
          />
        </div>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content="Helpful tip">
            <Button variant="secondary">Hover me</Button>
          </Tooltip>
          <Popover trigger={<Button variant="secondary">Popover</Button>}>
            <p className="text-sm text-muted">Any content goes here.</p>
          </Popover>
          <Dropdown
            trigger={<Button variant="secondary">Menu</Button>}
            items={[
              { label: "Edit", icon: "settings", onSelect: () => toast("Edit") },
              { label: "Delete", icon: "close", danger: true, onSelect: () => toast("Delete") },
            ]}
          />
          <Button variant="secondary" onClick={() => setDialog(true)}>Open dialog</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button>
        </div>
        <div className="mt-4">
          <Tabs
            items={[
              { id: "one", label: "Overview", content: <p className="text-sm text-muted">Tab one content.</p> },
              { id: "two", label: "Details", content: <p className="text-sm text-muted">Tab two content.</p> },
            ]}
          />
        </div>
        <div className="mt-4">
          <Accordion
            items={[
              { id: "a", title: "What is ProofChain?", content: "AI-verified provenance + settlement." },
              { id: "b", title: "How do writes work?", content: "Via TxButton with full lifecycle UX." },
            ]}
          />
        </div>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Example dialog" description="A modal in a portal." footer={<Button onClick={() => setDialog(false)}>Done</Button>}>
          <p className="text-sm text-muted">Body content with focus trap and scroll lock.</p>
        </Dialog>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Example drawer">
          <p className="text-sm text-muted">Slide-in panel content.</p>
        </Drawer>
      </Section>

      <Section title="Feedback & progress">
        <div className="flex flex-wrap items-center gap-4">
          <Spinner />
          <div className="w-40"><Progress value={64} /></div>
          <div className="w-40"><Meter value={78} label="Score" high={70} low={40} /></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton />
          <SkeletonText lines={3} />
        </div>
        <div className="mt-4 grid gap-3">
          <Callout tone="info" title="Heads up">This is an informational callout.</Callout>
          <Callout tone="warn" title="Careful">Something needs attention.</Callout>
          <Callout tone="danger" title="Error">Something went wrong.</Callout>
        </div>
      </Section>

      <Section title="Navigation">
        <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Batches", href: "/batches" }, { label: "0xabc…def" }]} />
        <div className="mt-4">
          <Stepper current={1} steps={[{ label: "Approve" }, { label: "Sign" }, { label: "Confirm" }]} />
        </div>
        <div className="mt-4">
          <Pagination page={0} limit={10} total={42} onPageChange={() => undefined} />
        </div>
      </Section>

      <Section title="Content">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Card" description="A surface container." />
            <p className="text-sm text-muted">Card body content.</p>
          </Card>
          <div className="space-y-3">
            <CodeBlock title="example.ts" code={'const x = "hello";\nconsole.log(x);'} />
            <div className="flex items-center gap-3">
              <CopyButton value="0xabc" label="Copy hash" />
              <JsonViewer data={{ id: 1, name: "batch", tags: ["a", "b"] }} collapsed />
            </div>
          </div>
        </div>
        <Divider label="Section" className="my-6" />
        <EmptyState title="No results" description="Try adjusting your filters." />
      </Section>

      <Section title="Data display">
        <KpiRow
          items={[
            { label: "Batches", value: "1,204", hint: "+12%", hintTone: "success" },
            { label: "Volume", value: "$4.2M", hint: "settled" },
            { label: "Pass rate", value: "97.3%", hint: "AA", hintTone: "brand" },
            { label: "Open disputes", value: "3", hint: "-1", hintTone: "success" },
          ]}
        />
        <div className="mt-4">
          <Toolbar
            actions={<ViewToggle value={view} onChange={setView} />}
          >
            <FilterBar>
              <Tag>status: active</Tag>
              <Tag>chain: base</Tag>
            </FilterBar>
          </Toolbar>
        </div>
        <div className="mt-4">
          {view === "table" ? (
            <DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} sort={sort} onSortChange={setSort} selectable />
          ) : (
            <CardGrid
              items={ROWS}
              getKey={(r) => r.id}
              renderItem={(r) => (
                <Card>
                  <p className="font-medium text-fg">{r.name}</p>
                  <p className="font-mono text-sm text-muted">{r.value}</p>
                </Card>
              )}
            />
          )}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatCard label="Sparkline" value={<Sparkline data={SERIES} />} />
          <Card><LineChart data={SERIES} /></Card>
          <Card><AreaChart data={SERIES} colorClassName="text-sustainability" /></Card>
          <Card><BarChart data={SERIES} colorClassName="text-markets" /></Card>
          <Card className="flex items-center justify-center">
            <DonutChart
              slices={[
                { label: "Pass", value: 70, colorClassName: "text-success" },
                { label: "Warn", value: 20, colorClassName: "text-warn" },
                { label: "Fail", value: 10, colorClassName: "text-danger" },
              ]}
            />
          </Card>
          <Card>
            <MapPreview
              points={[
                { x: 0.1, y: 0.8, kind: "origin" },
                { x: 0.5, y: 0.4, kind: "checkpoint" },
                { x: 0.9, y: 0.2, kind: "destination" },
              ]}
              height={140}
            />
          </Card>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Timeline
            events={[
              { id: "1", title: "Batch registered", timestamp: "12:04", tone: "brand" },
              { id: "2", title: "Checkpoint added", timestamp: "13:20", tone: "info" },
              { id: "3", title: "Attestation passed", timestamp: "14:02", tone: "success" },
            ]}
          />
          <FileDropzone onFiles={() => toast("Files received")} hint="PNG, PDF up to 10MB" maxSize={10_000_000} onError={(m) => toast.error(m)} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">{title}</h2>
      <div className="rounded-xl border border-border bg-surface/40 p-5">{children}</div>
    </section>
  );
}
