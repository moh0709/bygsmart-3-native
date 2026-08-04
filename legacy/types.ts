
// FIX: Removed self-import of `User`, which conflicted with the local declaration of the User interface.
export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'EXTERNAL' | 'CLIENT';
export type MemberStatus = 'ACTIVE' | 'PENDING';

export type SubscriptionTier = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';

export type AppRole = 'admin' | 'user';
export type JobTitle = 'CEO' | 'Manager' | 'Staff' | 'No title';
export type TeamRole = 'leader' | 'staff' | 'member' | null;

export interface User {
  id: string;
  username: string;
  name: string;
  initials: string;
  email?: string;
  subscriptionTier: SubscriptionTier;
  isDemo?: boolean;
  demoContactEmail?: string;
  appRole: AppRole;
  companyName?: string | null;
  // Extended profile fields
  jobTitle?: JobTitle | null;
  cvr?: string | null;
  address?: string | null;
  phone?: string | null;
  teamId?: string | null;
  teamRole?: TeamRole;
  createdAt?: string | null;
  /** Admin-granted trial: subscriptionTier above already reflects this while active. */
  isTrialActive?: boolean;
  trialEndsAt?: string | null;
}

export interface ProjectMember {
    id: string; // User ID or Email placeholder
    name: string;
    initials: string;
    email?: string;
    role: UserRole;
    status: MemberStatus; // Added status
    joinedAt: string;
}

export type RegulationCategory = 'BR18' | 'SBI' | 'DS' | 'AB18' | 'AT';

export interface Regulation {
  id: string;
  title: string;
  chapter: string;
  section_ref: string;
  snippet: string;
  body_html: string;
  effective_from: string;
  tags: string[];
  version: string;
  source_url: string;
  category: RegulationCategory;
}

export interface Project {
  id: string;
  ownerId: string; // ID of the user who created/owns the project
  projectNumber: string;
  name: string;
  clientName: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string;
  address: string;
  description: string;
  regulationCount: number;
  checklistCount: number;
  isFavorite: boolean;
  floorPlanUrl?: string;
  milestone: {
      title: string;
      dueDateRelative: string;
  };
  team: ProjectMember[];
  
  // Financial data is optional because it is stripped for certain roles
  budget?: {
      total: number;
      used: number;
  };
}

export interface ChecklistItem {
    id: string;
    text: string;
    ruleRef: string;
    ruleId: string;
    checked: boolean;
}

export interface ActivityLogItem {
    id:string;
    type: 'completed' | 'upload' | 'addUser';
    user: string;
    description: string;
    timestamp: string;
}

export interface Comment {
    id: string;
    user: string;
    userInitials: string;
    text: string;
    timestamp: string;
    type?: 'chat' | 'log';
    attachmentUrl?: string;
}

export type TaskStatus = 'Igangværende' | 'Udført' | 'To Do' | 'Forfalden' | 'Annulleret';
export type TaskPriority = 'Høj' | 'Mellem' | 'Lav';
export interface Task {
    id: string;
    title: string;
    status: TaskStatus;
    priority?: TaskPriority;
    dueDate: string;
    projectName?: string;
    relatedLink?: {
        text: string;
        url: string;
    };
    assignees: { id: string; initials: string; name: string; isOwner?: boolean }[];
    description?: string;
    checklist?: ChecklistItem[];
    attachments?: {
        url: string;
        type: 'image' | 'pdf';
        name: string;
    }[];
    comments?: Comment[];
    isMilestone?: boolean;
    suggestedRegulations?: { id: string; title: string; }[];
    ownerId?: string; // To store the ID of the task owner (project owner_id, loaded on task detail)
    projectTeam?: ProjectMember[]; // Team members of the parent project (loaded on task detail)
    estimatedHours?: number; // New field for time management
    estimatedPrice?: number; // UI/service-layer only — no DB column yet; not persisted
    dependencies?: string[]; // IDs of tasks that must be completed before this one
    step?: string; // Hierarchical step number (e.g. "1.2.1")
    projectId?: string;
    // Task workspace / handover fields
    completedAt?: string;
    acceptanceReportPath?: string;
    handoverStatus?: 'none' | 'submitted' | 'accepted' | 'rejected';
    scope?: 'project' | 'quick';
    archivedAt?: string;
    createdAt?: string;
    /** Tab-registry ids hidden for this task instance ("Faner" settings) — always-on tabs are never included. */
    disabledTabs?: string[];
}

// --- Task Workspace Types ---

export type TaskDocumentationKind = 'text' | 'photo' | 'audio' | 'link' | 'file' | 'report';

export interface TaskDocumentationItem {
    id: string;
    taskId: string;
    projectId: string;
    authorId: string;
    authorName: string;
    kind: TaskDocumentationKind;
    body?: string;
    storagePath?: string;
    mimeType?: string;
    sizeBytes?: number;
    isPinned: boolean;
    comments?: Record<string, unknown>[];
    createdAt: string;
    updatedAt?: string;
}

export interface TaskCheckIn {
    id: string;
    taskId: string;
    projectId: string;
    userId: string;
    userName: string;
    checkedInAt: string;
    checkedOutAt?: string | null;
    checkinLat?: number | null;
    checkinLng?: number | null;
    checkinAccuracy?: number | null;
    autoClosed?: boolean;
    createdAt: string;
}

export interface TaskHandover {
    id: string;
    taskId: string;
    projectId: string;
    submittedBy: string;
    submittedAt: string;
    supplierSignaturePath?: string | null;
    status: 'submitted' | 'accepted' | 'rejected';
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    mesterSignaturePath?: string | null;
    rejectionReason?: string | null;
    snags?: Record<string, unknown>[] | null;
    reportPath?: string | null;
    createdAt: string;
}

export interface AcceptanceReportSettings {
    showBranding: boolean;
    showReportId: boolean;
    showVat: boolean;
    showTime: boolean;
    showDocumentation: boolean;
    showSnagList: boolean;
    showWarranty: boolean;
    showSignatures: boolean;
    showQualityControl: boolean;
}

export type TaskQualityControlType = 'visuel' | 'maaling' | 'dokumentation';
export type TaskQualityControlResult = 'godkendt' | 'ikke_godkendt';

export interface TaskQualityControlPhoto {
    storagePath: string;
    mimeType?: string;
    sizeBytes?: number;
}

export interface TaskQualityControl {
    id: string;
    taskId: string;
    projectId: string;
    authorId: string;
    authorName: string;
    controlPoint?: string;
    controlType?: TaskQualityControlType;
    requirementRef?: string;
    result?: TaskQualityControlResult;
    comments?: string;
    hasDeviation: boolean;
    deviationDescription?: string;
    deviationPhotos: TaskQualityControlPhoto[];
    correctiveAction?: string;
    deviationDeadline?: string;
    responsibleId?: string;
    responsibleName?: string;
    signaturePath?: string;
    controlDate: string;
    createdAt: string;
    updatedAt?: string;
}

export interface TaskChatMessage {
    id: string;
    taskId: string;
    projectId: string | null;
    senderId: string;
    senderName: string;
    body?: string;
    attachmentPath?: string;
    attachmentMime?: string;
    mentions: string[];
    createdAt: string;
}

export type PurchaseStatus = 'Afventer' | 'Bestilt' | 'Modtaget';
export interface PurchaseItem {
    id: string;
    name: string;
    details: string;
    quantity: number;
    price: number; // Unit price
    status: PurchaseStatus;
    supplier?: string;
    itemNumber?: string;
    attachment?: {
        url: string;
        type: 'image' | 'pdf';
        name: string;
    };
    expectedDeliveryDate?: string; // Forventet leveringsdato
    taskId?: string; // Linked task
    assigneeId?: string; // Responsible team member
}

export interface Supplier {
    id: string;
    name: string;
}

export interface VendorItem {
    id: string;
    supplierId: string;
    itemNumber: string;
    name: string;
    price: number;
    unit?: string;
}


export interface Reminder {
    id: string;
    title: string;
    dateTime: string;
    context: string;
    isCompleted: boolean;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export interface LogEntry {
    id: string;
    timestamp: string;
    level: LogLevel;
    message: string;
}

// Types for the Follow-ups tab
export type FollowUpCategory = 'Opgave' | 'Indkøb' | 'Påmindelse';
export type FollowUpStatus = 'Afventer' | 'Igangværende' | 'Forfalden' | 'Udført';

export interface FollowUpItem {
    id: string; // Composite ID, e.g., "task-task1"
    title: string;
    category: FollowUpCategory;
    dueDate: string | null;
    status: FollowUpStatus;
    isCompleted: boolean;
    hasReminder: boolean;
    originalUrl: string; // Deep link to the item
    originalRefId: string; // data-ref-id for highlighting
}

export interface PunchListLayout {
  id: string;
  projectId: string;
  title: string;
  reference?: string;
  fileUrl: string;
  createdAt: string;
}

export type PunchListItemStatus = 'Åben' | 'I gang' | 'Løst' | 'Kræver Supervisor';
export interface PunchListItem {
  id: string;
  projectId: string;
  layoutId: string;
  photoUrl: string;
  pin: { x: number; y: number }; // Percentage values
  description: string;
  status: PunchListItemStatus;
  timestamp: string;
  resolutionDueDate?: string; // Frist for udbedring
}

export interface Notification {
  id: string;
  text: string;
  timestamp: string;
  isRead: boolean;
  link: string;
  type?: string;           // 'info' | 'team_invite' | 'team_invite_accepted' | 'team_invite_declined' | ...
  metadata?: Record<string, unknown>; // arbitrary payload, e.g. { seat_id, team_name, tier }
}

// --- Time Management Types ---
export interface TimeEntry {
    id: string;
    projectId: string;
    taskId?: string; // Optional, can log time to project generally
    userId: string;
    userName: string; // Denormalized for simpler display
    hours: number;
    date: string; // ISO date string
    description: string;
}

// --- Document Management Types ---
export type DocumentCategory =
  | 'GENERAL'
  | 'TECHNICAL_DRAWINGS'
  | 'CONTRACT_LEGAL'
  | 'PLANNING_EXECUTION'
  | 'SAFETY_WORK'
  | 'ENVIRONMENT_COMPLIANCE'
  | 'FINANCE_ADMIN'
  | 'COMM_REPORTING'
  | 'HANDOVER_COMPLETION';

export type DrawingDiscipline =
  | 'ARCHITECTURE'
  | 'ELECTRICAL'
  | 'HVAC_VVS'
  | 'STRUCTURAL'
  | 'FIRE'
  | 'OTHER';

export type PlanType = 'FLOORPLAN' | 'PLAN';

export type DocumentAccessLevel = 'public_team' | 'managers_only' | 'custom_users';

export interface DocumentItem {
  id: string;
  projectId: string;
  name: string;
  storagePath: string; // Simulated with data URL for now
  sizeBytes: number;
  mimeType: string;
  category: DocumentCategory;
  referenceNo?: string;
  shortDescription?: string;
  accessLevel: DocumentAccessLevel;
  passwordProtected: boolean;
  createdBy: string; // User name for simplicity in mock
  createdAt: string; // ISO string
  reviewDeadline?: string; // Gennemgangsfrist / Udløbsdato

  // Drawing-specific fields
  isDrawing: boolean;
  discipline?: DrawingDiscipline;
  drawingNo?: string;
  revision?: string;
  scale?: string;
  issueDate?: string; // Date string
  sheetNo?: string;
  planType?: PlanType;
  planIndex?: number;
  isLatestRevision?: boolean;
}

// --- Quotation Types ---
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
export type QuotationLineKind = 'MATERIAL' | 'LABOR' | 'OTHER';

export interface QuotationLineItem {
  id: string;
  quotationId: string;
  kind: QuotationLineKind;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  lineTotal: number;
  source?: string;
  createdAt: string;
}

export interface Quotation {
  id: string;
  projectId: string;
  number: string;
  title: string;
  clientName: string;
  status: QuotationStatus;
  currency: string;
  vatRate: number;
  validUntil?: string;
  notes?: string;
  subtotal: number;
  vatTotal: number;
  total: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: QuotationLineItem[];
}

// --- Project Budget Types ---
export type ProjectBudgetCategory = 'materials' | 'labor' | 'subcontractors' | 'other';

export interface ProjectBudgetSummary {
  hasBaseline: boolean;
  plannedTotalKr: number;
  plannedByCategory: Record<ProjectBudgetCategory, number>;
  laborRateDkkPerHour: number | null;
  actualPurchasesForecastKr: number;
  actualPurchasesCommittedKr: number;
  actualPurchasesReceivedKr: number;
  actualLaborKr: number;
  actualSubcontractorsKr: number;
  actualTotalKr: number;
  remainingKr: number;
  forecastTotalKr: number;
}

export interface ProjectBudgetRevisionCategoryDelta {
  category: ProjectBudgetCategory;
  deltaKr: number;
}

export interface ProjectBudgetRevision {
  id: string;
  revisionNumber: number;
  reason: string;
  totalDeltaKr: number;
  categoryDeltas: ProjectBudgetRevisionCategoryDelta[];
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
}

// --- Unified Resource Model (T1) ---
export type ResourceKind = 'staff' | 'partner';
export type ResourceVisibility = 'all' | 'some' | 'standard' | 'none';
export type ResourceStatus = 'pending' | 'active' | 'declined' | 'cancelled';

export interface ProjectResource {
  id: string;
  projectId: string;
  userId: string | null;
  email: string | null;
  name: string;
  initials: string;
  kind: ResourceKind;
  visibility: ResourceVisibility;
  status: ResourceStatus;
  agreedPriceOre: number | null;
  currency: string;
  settledAt: string | null;
  joinedAt: string | null;
  invitedBy: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Partner (Underleverandør) Collaboration Types ---
export type PartnerInviteStatus = 'invited' | 'negotiating' | 'accepted' | 'declined' | 'cancelled';
export type PartnerNegotiationKind = 'message' | 'offer' | 'counter_offer' | 'accept' | 'decline';

export interface PartnerInvite {
  id: string;
  projectId: string;
  partnerId: string;
  invitedBy: string;
  status: PartnerInviteStatus;
  agreedPriceOre: number | null; // settled price in øre (1 DKK = 100 øre)
  currency: string;
  message?: string;
  createdAt: string;
  updatedAt?: string;
  settledAt?: string;
  // Denormalized display fields (joins / RPCs)
  partnerName?: string;
  partnerInitials?: string;
  projectName?: string;
  projectDeadline?: string;
  inviterName?: string;
  inviterInitials?: string;
  taskIds?: string[];
  taskCount?: number;
}

export interface PartnerNegotiationMessage {
  id: string;
  partnerInviteId: string; // backward compat — equals resourceId after T1
  resourceId?: string;     // canonical field (project_resources.id)
  senderId: string;
  kind: PartnerNegotiationKind;
  body?: string;
  amountOre: number | null;
  createdAt: string;
  /** Optional shared file (picture / PDF / Word / Excel). */
  attachmentPath?: string;  // canonical task-docs/... path, resolve via resolveFileUrl
  attachmentName?: string;  // original filename for display/download
  attachmentType?: string;  // MIME type
}

/** Scoped project view for partners: never budget, notes or member lists. */
export interface PartnerProjectView {
  id: string;
  name: string;
  description: string;
  deadline: string | null;
}

// --- Mapping / AR Types ---
export type MappedElementType = 'wall' | 'window' | 'door';

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface MappedElement {
    id: string;
    type: MappedElementType;
    start: Vector3;
    end: Vector3;
    length: number; // in meters
    height?: number; // optional override
    timestamp: number;
}

// --- Admin dashboard types ---

export interface AdminStats {
  userCount: number;
  companyCount: number;
  projectCount: number;
  taskCount: number;
  tasksSolved: number;
  tasksOverdue: number;
  activeTrials: number;
  trialsExpiringSoon: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  username: string;
  appRole: string;
  userType: 'normal' | 'test' | 'partner' | 'admin';
  subscriptionTier: string;
  isPaid: boolean;
  trialTier: string | null;
  trialEndsAt: string | null;
  isTrialActive: boolean;
  companyName: string | null;
  teamId: string | null;
  teamRole: string | null;
  teamCount: number;
  jobTitle: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isDemo: boolean;
  /** For demo accounts: the e-mail the visitor entered to start the demo. */
  demoContactEmail: string | null;
  hasBilling: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  isActive: boolean;
  bannedUntil: string | null;
  emailConfirmed: boolean | null;
  sessionCount: number;
}

export interface AdminInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
}

/** A period comparison figure: current-window value, previous-window value, and derived % change. */
export interface AdminPeriodDelta {
  current: number;
  previous: number;
  changePct: number | null;
}

export interface AdminOverviewData {
  stats: AdminStats;
  users: AdminUser[];
  period: {
    from: string;
    to: string;
    newUsers: AdminPeriodDelta;
    newCompanies: AdminPeriodDelta;
    tasksSolved: AdminPeriodDelta;
    projectsFinished: AdminPeriodDelta;
  };
}

export interface AdminRevenueData {
  mrrOre: number;
  arrOre: number;
  currency: string;
  activeSubscriptions: number;
  byTier: Record<string, number>;
  avgRevenuePerTeamOre: number;
  newSubscriptions: AdminPeriodDelta;
  cancelledSubscriptions: AdminPeriodDelta;
  note?: string;
}

export interface AdminTeamSeat {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'declined';
  name: string | null;
  jobTitle: string | null;
  profileId: string | null;
  createdAt: string;
}

export interface AdminTeam {
  id: string;
  name: string;
  leaderId: string;
  leaderName: string | null;
  leaderEmail: string | null;
  createdAt: string;
  seats: AdminTeamSeat[];
  activeSeatCount: number;
  pendingSeatCount: number;
}

export interface AdminTeamsData {
  teams: AdminTeam[];
  totals: {
    teamCount: number;
    activeSeats: number;
    pendingSeats: number;
    avgSeatsPerTeam: number;
    utilizationPct: number;
  };
  period: {
    newTeams: AdminPeriodDelta;
  };
}

/** A demo account that never completed the welcome step — bulk-purge candidate. */
export interface AdminPurgeableDemoUser {
  id: string;
  name: string;
  email: string | null;
  demoContactEmail: string | null;
  createdAt: string | null;
}

export interface AdminOrgMember {
  userId: string | null;
  name: string;
  email: string | null;
  role: 'owner' | 'admin' | 'member' | string;
  isDemo: boolean;
  joinedAt: string | null;
}

export interface AdminOrganization {
  id: string;
  name: string;
  cvr: string | null;
  address: string | null;
  /** Pre-marketplace org with full module access; new orgs start lean. */
  grandfathered: boolean;
  storageAllowanceGb: number;
  createdAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerTier: string | null;
  /** True when the owner is still on a demo account — orgs carry no flag of their own. */
  isDemo: boolean;
  demoContactEmail: string | null;
  memberCount: number;
  pendingInviteCount: number;
  projectCount: number;
  members: AdminOrgMember[];
}

export interface AdminOrganizationsData {
  organizations: AdminOrganization[];
  totals: {
    orgCount: number;
    demoOrgCount: number;
    grandfatheredCount: number;
    pendingInvites: number;
    avgMembersPerOrg: number;
    /** The list is capped server-side; true when more organisations exist. */
    truncated: boolean;
  };
  period: {
    newOrganizations: AdminPeriodDelta;
  };
}

export interface AdminDelegationData {
  activeSubcontractors: number;
  pendingSubcontractors: number;
  delegatedTasks: number;
  delegatedTasksSolved: number;
  period: {
    newDelegations: AdminPeriodDelta;
    delegatedTasksSolved: AdminPeriodDelta;
  };
}

export interface AdminReportsData {
  taskHandovers: { submitted: number; accepted: number; rejected: number };
  terminationReports: number;
  aiHandoverReports: number;
  totalReports: number;
  period: {
    totalReports: AdminPeriodDelta;
  };
}

export interface FloorPlan {
    id: string;
    elements: MappedElement[];
    createdAt: string;
    totalPerimeter: number;
    estimatedArea: number;
}
