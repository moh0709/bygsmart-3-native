import React, { useState } from 'react';
import {
  Alert,
  AppScreen,
  Avatar,
  AvatarGroup,
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  FAB,
  Input,
  ListRow,
  Modal,
  ProgressBar,
  ProgressRing,
  SegmentedControl,
  Select,
  Skeleton,
  SkeletonList,
  StatCard,
  Tabs,
  Textarea,
  Tooltip,
} from '../components/ui';
import { CheckSquareIcon, FolderIcon, ShoppingCartIcon, AlertTriangleIcon, CameraIcon } from '../components/icons';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-8">
    <h2 className="text-heading text-text-primary dark:text-text-dark-primary mb-3">{title}</h2>
    {children}
  </section>
);

/**
 * Living gallery of Design System 2.0 — the reference for every screen
 * migration (docs/UI_OVERHAUL_PLAN.md). Route: /design
 */
const DesignSystemPage: React.FC = () => {
  const [seg, setSeg] = useState('liste');
  const [chipOn, setChipOn] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AppScreen
      header={{
        title: 'Design System 2.0',
        subtitle: 'Tokens · primitives · mønstre — reference for alle skærme',
        back: '/home',
      }}
    >
      <Section title="Typografi (text-display → text-caption)">
        <Card padding="md">
          <p className="text-display">Display 28</p>
          <p className="text-title">Title 22</p>
          <p className="text-heading">Heading 17</p>
          <p className="text-body">Body 15 — brødtekst til beskrivelser og indhold.</p>
          <p className="text-label">Label 13 — knapper, rækker, metadata.</p>
          <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Caption 11 — mindste tilladte størrelse.</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="StatCard — KPI-fliser (heltal, da-DK)">
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard value={6} label="Aktive projekter" tone="brand" icon={<FolderIcon className="w-5 h-5" />} onClick={() => {}} />
          <StatCard value={0} label="Opgaver i dag" tone="success" icon={<CheckSquareIcon className="w-5 h-5" />} />
          <StatCard value={14} label="Overskredne" tone="danger" icon={<AlertTriangleIcon className="w-5 h-5" />} onClick={() => {}} />
          <StatCard value={69} label="Afventer indkøb" tone="warning" icon={<ShoppingCartIcon className="w-5 h-5" />} />
        </div>
      </Section>

      <Section title="Badge & Chip">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge variant="brand">PRO</Badge>
          <Badge variant="success" dot>I rute</Badge>
          <Badge variant="warning" dot>Opstart</Badge>
          <Badge variant="danger" dot>Forfalden</Badge>
          <Badge variant="info">Review</Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Chip selected={chipOn} count={27} onClick={() => setChipOn(!chipOn)}>Alle</Chip>
          <Chip count={14}>Forfaldne</Chip>
          <Chip>I dag</Chip>
          <Chip>Partner</Chip>
        </div>
      </Section>

      <Section title="Avatar & AvatarGroup">
        <div className="flex items-center gap-4">
          <Avatar name="Moi Ismail" size="lg" online />
          <Avatar name="Anders Andersen" size="md" />
          <Avatar name="Bente Bertelsen" size="sm" online />
          <AvatarGroup
            people={[
              { name: 'Anders Andersen', online: true },
              { name: 'Bente Bertelsen' },
              { name: 'Carl Christiansen' },
              { name: 'Dorte Dam' },
              { name: 'Erik Eriksen' },
            ]}
            max={3}
          />
        </div>
      </Section>

      <Section title="Progress">
        <Card padding="md" className="flex items-center gap-6">
          <div className="grow flex flex-col gap-3">
            <ProgressBar value={72} label="Fremgang" />
            <ProgressBar value={35} tone="warning" size="sm" label="Budget" />
            <ProgressBar value={92} tone="success" size="sm" label="Plan" />
          </div>
          <ProgressRing value={59} tone="warning" diameter={56} label="Projekt-sundhed" />
          <ProgressRing value={100} tone="success" label="Færdig" />
        </Card>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          label="Visning"
          value={seg}
          onChange={setSeg}
          options={[
            { label: 'Liste', value: 'liste' },
            { label: 'Gruppe', value: 'gruppe' },
            { label: 'Opdelt', value: 'opdelt' },
            { label: 'Kanban', value: 'kanban' },
          ]}
        />
      </Section>

      <Section title="Alert / Callout">
        <div className="flex flex-col gap-2.5">
          <Alert variant="info" title="Vidste du?">Du kan gemme beregninger direkte til et projekt.</Alert>
          <Alert variant="success" title="Gemt">Dine ændringer er synkroniseret.</Alert>
          <Alert variant="warning" title="14 overskredne deadlines" action={<Button size="sm" variant="outline">Se</Button>}>
            Villa Renovering · 12 — Tag &amp; Loft · 2
          </Alert>
          <Alert variant="danger" title="Kunne ikke gemme">Tjek din forbindelse og prøv igen.</Alert>
        </div>
      </Section>

      <Section title="ListRow (i Card)">
        <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
          <ListRow
            leading={<Avatar name="Anders Andersen" size="sm" online />}
            title="Opsætning af stillads på baghavdel"
            subtitle="Renovering: Tag & Loft"
            trailing={<Badge variant="danger" dot>15/6</Badge>}
            onClick={() => {}}
          />
          <ListRow
            leading={<Avatar name="Bente Bertelsen" size="sm" />}
            title="1.2.2 Ny vandledning køkken → bad"
            subtitle="Villa Renovering · Kildeskovgård 12"
            trailing={<Badge>12/2</Badge>}
            onClick={() => {}}
          />
          <ListRow title="Statisk række uden handling" subtitle="Ingen chevron, ingen hover" trailing={<Badge variant="info">Review</Badge>} />
        </Card>
      </Section>

      <Section title="Tooltip">
        <div className="flex gap-3">
          <Tooltip content="Vises ved hover og tastatur-fokus">
            <Button variant="outline">Hover / fokusér mig</Button>
          </Tooltip>
          <Tooltip content="Auto-flipper ved skærmkant" placement="right">
            <Button variant="ghost">Placering: højre</Button>
          </Tooltip>
        </div>
      </Section>

      <Section title="Form (Field)">
        <Card padding="md" className="flex flex-col gap-4">
          <Input label="Projektnavn" placeholder="fx Renovering: Tag & Loft" hint="Vises på rapporter og tilbud" />
          <Input label="E-mail" error="Ugyldig e-mailadresse" defaultValue="ikke-en-email" />
          <Select label="Rolle" defaultValue="worker">
            <option value="owner">Ejer (Mester)</option>
            <option value="manager">Projektleder (Formand)</option>
            <option value="worker">Medarbejder (Svend)</option>
            <option value="client">Kunde (Bygherre)</option>
          </Select>
          <Textarea label="Beskrivelse" placeholder="Kort beskrivelse af opgaven…" rows={3} />
        </Card>
      </Section>

      <Section title="Modal · BottomSheet · ConfirmDialog">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModalOpen(true)}>Åbn Modal</Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>Åbn BottomSheet</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Åbn ConfirmDialog</Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Standard modal"
          description="Fokus-fælde, Escape, scroll-lås — bottom sheet på mobil."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuller</Button>
              <Button onClick={() => setModalOpen(false)}>Gem</Button>
            </>
          }
        >
          <p className="text-body text-text-secondary dark:text-text-dark-secondary">Alt modalindhold i appen skal rendere gennem denne komponent.</p>
        </Modal>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Mere">
          <div className="-mx-5">
            <ListRow title="Partnere" subtitle="1 aktiv forhandling" trailing={<Badge variant="warning">1</Badge>} onClick={() => setSheetOpen(false)} />
            <ListRow title="Opfølgning" subtitle="Kvalitetssikring & tilsyn" onClick={() => setSheetOpen(false)} />
            <ListRow title="Dokumenter" subtitle="12 filer · 3 kontrakter" onClick={() => setSheetOpen(false)} />
          </div>
        </BottomSheet>
        <ConfirmDialog
          isOpen={confirmOpen}
          title="Slet projekt?"
          message="Dette kan ikke fortrydes. Alle opgaver, dokumenter og tidsregistreringer slettes."
          confirmLabel="Slet"
          danger
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Section>

      <Section title="Loading & Empty">
        <div className="grid sm:grid-cols-2 gap-3">
          <Card padding="md">
            <Skeleton className="h-5 w-2/5 mb-3" />
            <SkeletonList count={2} />
          </Card>
          <Card padding="md">
            <EmptyState
              icon={<CameraIcon className="w-8 h-8" />}
              title="Ingen fotos endnu"
              description="Tag det første punch-foto for at dokumentere kvaliteten."
              action={<Button size="sm">Nyt punch-punkt</Button>}
            />
          </Card>
        </div>
      </Section>

      <FAB aria-label="Ny opgave" label="Ny opgave" icon={
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      } />
    </AppScreen>
  );
};

export default DesignSystemPage;
