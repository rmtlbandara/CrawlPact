import { useState } from "react";
import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import {
  Accordion,
  Alert,
  Banner,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  CodeBlock,
  Combobox,
  ConfirmDialog,
  DataTable,
  DiffViewer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  EvidenceRail,
  FormField,
  IconButton,
  Input,
  Link,
  MetricCard,
  Modal,
  Pagination,
  Popover,
  ProgressSteps,
  ProvenanceHeader,
  PurposeLane,
  RadioGroup,
  ScoreComponent,
  SearchField,
  Select,
  Skeleton,
  StatusChip,
  Switch,
  Tabs,
  Textarea,
  Tooltip,
} from "@crawlpact/ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-8">
      <h2 className="mb-4 text-h3 text-neutral-950">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export function ComponentShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [comboValue, setComboValue] = useState("gptbot");
  const [page, setPage] = useState(1);

  return (
    <div>
      <Section title="Button">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button isLoading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="IconButton and Link">
        <IconButton icon={<Bell />} label="Notifications" />
        <Link href="#">Descriptive link text</Link>
      </Section>

      <Section title="Form controls">
        <FormField label="Domain" description="Enter a domain to audit." error="">
          <Input placeholder="example.com" />
        </FormField>
        <FormField label="Notes">
          <Textarea placeholder="Optional notes" />
        </FormField>
        <SearchField label="Search crawlers" placeholder="Search…" />
        <Select
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
          ]}
          placeholder="Monitoring frequency"
          ariaLabel="Monitoring frequency"
        />
        <Combobox
          label="Crawler"
          value={comboValue}
          onChange={setComboValue}
          options={[
            { value: "gptbot", label: "GPTBot" },
            { value: "claudebot", label: "ClaudeBot" },
            { value: "perplexitybot", label: "PerplexityBot" },
          ]}
        />
        <Checkbox label="Enable monitoring" />
        <RadioGroup
          legend="Policy preset"
          options={[
            { value: "max", label: "Maximum AI visibility" },
            { value: "search-only", label: "Allow search, block training" },
          ]}
        />
        <Switch label="Reduced motion" description="Minimise animation" />
      </Section>

      <Section title="Status chip">
        <StatusChip tone="success" label="Allowed" />
        <StatusChip tone="warning" label="No explicit rule" />
        <StatusChip tone="error" label="Blocked" />
        <StatusChip tone="critical" label="Critical" />
        <StatusChip tone="info" label="Informational" />
        <StatusChip tone="unknown" label="Unknown" />
      </Section>

      <Section title="Tooltip and Popover">
        <Tooltip content="Additional context on hover or focus">
          <Button variant="secondary">Hover me</Button>
        </Tooltip>
        <Popover trigger={<Button variant="secondary">Open popover</Button>}>
          <p className="text-body text-neutral-700">Popover content</p>
        </Popover>
        <DropdownMenu
          trigger={<Button variant="secondary">Open menu</Button>}
          items={[
            { label: "Edit", onSelect: () => {} },
            { label: "Delete", onSelect: () => {}, destructive: true },
          ]}
        />
      </Section>

      <Section title="Modal, ConfirmDialog, Drawer">
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Example modal"
          description="Modal description text."
        >
          <p>Modal body content.</p>
        </Modal>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Delete domain
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete this domain?"
          description="This removes its scan history. This cannot be undone."
          destructive
          confirmLabel="Delete domain"
          onConfirm={() => {}}
        />
      </Section>

      <Section title="Tabs and Accordion">
        <div className="w-full max-w-md">
          <Tabs
            tabs={[
              {
                value: "overview",
                label: "Overview",
                content: <p className="text-body">Overview content</p>,
              },
              {
                value: "findings",
                label: "Findings",
                content: <p className="text-body">Findings content</p>,
              },
            ]}
          />
        </div>
        <div className="w-full max-w-md">
          <Accordion
            items={[
              {
                value: "a",
                title: "What is CrawlPact?",
                content: <p>An AI crawler policy auditor.</p>,
              },
            ]}
          />
        </div>
      </Section>

      <Section title="Breadcrumb and Pagination">
        <Breadcrumb items={[{ label: "Domains", href: "/app" }, { label: "example.com" }]} />
        <Pagination page={page} pageCount={5} onPageChange={setPage} />
      </Section>

      <Section title="Card, MetricCard">
        <Card title="Card title" eyebrow="Eyebrow">
          <p className="text-body text-neutral-700">Card body content.</p>
        </Card>
        <MetricCard
          label="Saved domains"
          value={12}
          trend={{ direction: "up", label: "+2 this month" }}
        />
      </Section>

      <Section title="Alert, Banner">
        <Alert tone="warning" title="Review needed">
          One crawler has no explicit rule.
        </Alert>
        <div className="w-full">
          <Banner tone="information">Preview environment</Banner>
        </div>
      </Section>

      <Section title="Skeleton, EmptyState, ErrorState">
        <Skeleton className="h-10 w-48" />
        <EmptyState
          title="No domains yet"
          description="Add your first domain to save audit history."
          icon={<Search />}
        />
        <ErrorState
          title="The website could not be reached"
          description="CrawlPact could not establish a secure connection."
        />
      </Section>

      <Section title="ProgressSteps">
        <ProgressSteps
          steps={[
            { id: "a", label: "Validating target" },
            { id: "b", label: "Retrieving robots.txt" },
            { id: "c", label: "Generating findings" },
          ]}
          currentStepId="b"
          completedStepIds={["a"]}
        />
      </Section>

      <Section title="DataTable">
        <div className="w-full">
          <DataTable
            columns={[
              { key: "name", header: "Crawler", render: (row: { name: string }) => row.name },
              {
                key: "purpose",
                header: "Purpose",
                render: (row: { purpose: string }) => row.purpose,
              },
            ]}
            rows={[
              { name: "GPTBot", purpose: "Training" },
              { name: "OAI-SearchBot", purpose: "Search" },
            ]}
            getRowKey={(row) => row.name}
          />
        </div>
      </Section>

      <Section title="CodeBlock, DiffViewer">
        <div className="w-full max-w-lg">
          <CodeBlock language="text" code={"User-agent: GPTBot\nDisallow: /"} />
        </div>
        <div className="w-full max-w-lg">
          <DiffViewer
            lines={[
              { type: "unchanged", text: "User-agent: *" },
              { type: "removed", text: "Disallow:" },
              { type: "added", text: "Disallow: /private/" },
            ]}
          />
        </div>
      </Section>

      <Section title="ScoreComponent">
        <div className="w-full max-w-sm">
          <ScoreComponent
            score={{ state: "scored", value: 82, label: "Good" }}
            methodologyHref="/scoring"
          />
        </div>
        <div className="w-full max-w-sm">
          <ScoreComponent score={{ state: "incomplete" }} />
        </div>
      </Section>

      <Section title="ProvenanceHeader">
        <div className="w-full max-w-2xl">
          <ProvenanceHeader
            domain="example.com"
            reportState={{ tone: "success", label: "Complete" }}
            fields={[
              { label: "Scan time", value: "28 Jul 2026, 09:12 UTC" },
              { label: "Registry version", value: "2026.07.1" },
              { label: "Ruleset version", value: "4" },
              { label: "Preset", value: "Balanced" },
            ]}
          />
        </div>
        <div className="w-full max-w-2xl">
          <ProvenanceHeader
            domain="incomplete-example.com"
            reportState={{ tone: "unknown", label: "Incomplete" }}
            fields={[
              { label: "Scan time", value: "28 Jul 2026, 09:12 UTC" },
              { label: "Registry version", value: null },
              { label: "Ruleset version", value: null },
              { label: "Preset", value: "Balanced" },
            ]}
            context="Shared by Acme Agency on 12 Jan 2026."
          />
        </div>
      </Section>

      <Section title="EvidenceRail">
        <div className="w-full max-w-xl">
          <EvidenceRail
            title="GPTBot rule in robots.txt"
            item={{
              observed: "User-agent: GPTBot / Disallow: /private/",
              interpretation: "GPTBot is blocked from /private/, allowed elsewhere.",
              impact: "Training crawlers cannot access the disallowed path.",
              action: "No action needed if this matches your intent.",
              evidence: <code className="text-code">robots.txt, line 14</code>,
            }}
          />
        </div>
        <div className="w-full max-w-xl">
          <EvidenceRail
            title="llms.txt"
            item={{
              observed: null,
              interpretation: null,
              impact: null,
              action: "Consider publishing an llms.txt file to document AI crawler preferences.",
              evidence: null,
            }}
          />
        </div>
      </Section>

      <Section title="PurposeLane">
        <PurposeLane
          entries={[
            { purpose: "Search", tone: "success", summary: "4 of 4 crawlers allowed" },
            { purpose: "Training", tone: "warning", summary: "1 of 3 crawlers blocked" },
            { purpose: "User-triggered retrieval", tone: "success", summary: "2 of 2 allowed" },
            { purpose: "Agents", tone: "unknown", summary: "No explicit rule" },
          ]}
        />
      </Section>
    </div>
  );
}
