// Demo Seed Data - Comprehensive Renovation Project for ByggeSmart Platform
// This file contains a complete demo project that showcases all platform features

import type { TaskStatus, PurchaseStatus } from '../types';

export interface DemoProjectData {
  project: {
    name: string;
    description: string;
    address: string;
    clientName: string;
    budget: { total: number; used: number };
    startDate: string;
    endDate: string;
  };
  team: Array<{
    id: string;
    name: string;
    initials: string;
    role: string;
    status: string;
    email?: string;
  }>;
  tasks: Array<{
    title: string;
    description: string;
    status: TaskStatus;
    dueDate: string;
    step?: string;
    estimatedHours: number;
    suggestedRegulations?: Array<{ id: string; title: string }>;
    checklist?: Array<{ id: string; text: string; checked: boolean; ruleId: string; ruleRef: string }>;
    assignees?: Array<{ id: string; initials: string; name: string }>;
  }>;
  purchases: Array<{
    name: string;
    details: string;
    quantity: number;
    price: number;
    status: PurchaseStatus;
    supplier: string;
    itemNumber?: string;
  }>;
  documents?: Array<{
    name: string;
    category: string;
    isDrawing: boolean;
    discipline?: string;
    drawingNo?: string;
    revision?: string;
  }>;
  reminders?: Array<{
    title: string;
    dateTime: string;
    context: string;
  }>;
  punchListLayouts?: Array<{
    title: string;
    reference?: string;
    fileUrl: string;
  }>;
  punchListItems?: Array<{
    layoutTitle: string;
    description: string;
    status: string;
    pin: { x: number; y: number };
    photoUrl?: string;
    resolutionDueDate: string;
  }>;
  timeEntries?: Array<{
    userId: string;
    userName: string;
    hours: number;
    date: string;
    description: string;
  }>;
}

// Main demo project: Villa Renovation in Lyngby
export const DEMO_PROJECT: DemoProjectData = {
  project: {
    name: 'Villa Renovering - Kildeskovgård 12',
    description: 'Omfattende renovering af 150m² villa bygget i 1970. Omfatter ny indvendig opsætning, badeværelser, køkken og facadeopdatering. Projektet kører over 4 måneder med fokus på energioptimering og moderne indretning.',
    address: 'Kildeskovgård 12, 2800 Kongens Lyngby',
    clientName: 'Morten og Ida Hansen',
    budget: { total: 850000, used: 625000 },
    startDate: '2026-01-15',
    endDate: '2026-05-15',
  },
  team: [
    {
      id: 'user_demo_owner',
       name: 'Morten Hansen',
       initials: 'MH',
       role: 'OWNER',
       status: 'ACTIVE',
       email: 'morten.hansen@email.dk',
     },
     {
       id: 'user_demo_manager',
       name: 'Anders Andersen',
       initials: 'AA',
       role: 'MANAGER',
       status: 'ACTIVE',
       email: 'anders@bygger.dk',
     },
     {
       id: 'user_demo_employee1',
       name: 'Bente Bertelsen',
       initials: 'BB',
       role: 'EMPLOYEE',
       status: 'ACTIVE',
       email: 'bente@bygger.dk',
     },
     {
       id: 'user_demo_employee2',
       name: 'Carl Christiansen',
       initials: 'CC',
       role: 'EMPLOYEE',
       status: 'ACTIVE',
       email: 'carl@bygger.dk',
     },
     {
       id: 'user_demo_external',
       name: 'El-Tech Elservice ApS',
       initials: 'EE',
       role: 'EXTERNAL',
       status: 'ACTIVE',
     },
  ],
  tasks: [
    // FASE 1: Opstart & Nedrivning
    {
      title: '1.1.1 Genoptagelse og projektstart',
      description: 'Projektgennemgang med klient, levering af nøgler og sikkerhedstjek af byggeplads',
      status: 'Udført',
      dueDate: '2026-01-15',
      step: '1.1.1',
      estimatedHours: 4,
      suggestedRegulations: [{ id: 'br18-kap2', title: 'BR18 Kap. 2: Byggetilladelse' }],
      assignees: [{ id: 'user_manager_01', initials: 'AA', name: 'Anders Andersen' }],
    },
    {
      title: '1.1.2 Nedrivning af gammelt køkken og bad',
      description: 'Fjernelse af flisearbejde, gammelt køkkenhus, WC og vaskemaskine. Miljøansvarlig bortflytning af byggeskommissionen.',
      status: 'Udført',
      dueDate: '2026-01-25',
      step: '1.1.2',
      estimatedHours: 24,
      checklist: [
        { id: 'c1', text: 'Afmontér gammelt køkken', checked: true, ruleId: 'br18-kap20', ruleRef: 'BR18 §388' },
        { id: 'c2', text: 'Bortflytning gennem autoriseret miljøfirma', checked: true, ruleId: 'br18-kap2', ruleRef: 'Miljøstyrelsen' },
      ],
      assignees: [{ id: 'user_employee_01', initials: 'BB', name: 'Bente Bertelsen' }],
    },
    {
      title: '1.2.1 Installation af midterdæk',
      description: 'Etablering af midterdæk for adskillelse af stue og entré',
      status: 'Udført',
      dueDate: '2026-02-01',
      step: '1.2.1',
      estimatedHours: 16,
      suggestedRegulations: [{ id: 'br18-kap11', title: 'BR18 Kap. 11: Energi' }],
      assignees: [{ id: 'user_employee_02', initials: 'CC', name: 'Carl Christiansen' }],
    },
    {
      title: '1.2.2 Ny vandledning fra køkken til bad',
      description: 'Installation af ny rørledning i gulvhus for koldt og varmt vand plus afløb',
      status: 'Igangværende',
      dueDate: '2026-02-12',
      step: '1.2.2',
      estimatedHours: 12,
      suggestedRegulations: [{ id: 'br18-kap20', title: 'BR18 Kap. 20: Vand' }],
      assignees: [{ id: 'user_external_01', initials: 'EE', name: 'El-Tech Elservice ApS' }],
    },
    // FASE 2: Råhus & Installationer
    {
      title: '2.1.1 Gipsvæg mellem stue og entré',
      description: 'Opbygning af 13mm gipsvæg med stålstoler, inkl. indblanding af skjult døråbning',
      status: 'Igangværende',
      dueDate: '2026-02-20',
      step: '2.1.1',
      estimatedHours: 20,
      suggestedRegulations: [
        { id: 'br18-kap17', title: 'BR18 Kap. 17: Lyd' },
        { id: 'br18-kap5', title: 'BR18 Kap. 5: Brand' },
      ],
      checklist: [
        { id: 'c3', text: 'Montering af stålstoler c/c 600mm', checked: true, ruleId: '', ruleRef: '' },
        { id: 'c4', text: 'Brandklasse REI 60 dokumentation', checked: false, ruleId: '', ruleRef: '' },
      ],
      assignees: [{ id: 'user_employee_01', initials: 'BB', name: 'Bente Bertelsen' }],
    },
    {
      title: '2.1.2 Ny el før køkkenområde',
      description: 'Installation af ny opvurs 3x1,5mm kabel + 3x2,5mm til køkken, inkl. LED spots og hulenettstikkontakt',
      status: 'To Do',
      dueDate: '2026-02-25',
      step: '2.1.2',
      estimatedHours: 8,
      suggestedRegulations: [{ id: 'br18-kap19', title: 'BR18 Kap. 19: Elektrisk anlæg' }],
      assignees: [{ id: 'user_external_01', initials: 'EE', name: 'El-Tech Elservice ApS' }],
    },
    {
      title: '2.2.1 Vådrumsmembran i nyserveret bad',
      description: 'Anbringelse af kjærligergummi membran på alle væge og gulv, tryksøgning og bekæmpning af kantovergange',
      status: 'To Do',
      dueDate: '2026-03-05',
      step: '2.2.1',
      estimatedHours: 16,
      suggestedRegulations: [{ id: 'br18-kap13', title: 'BR18 Kap. 13: Vådrum' }],
      assignees: [{ id: 'user_employee_02', initials: 'CC', name: 'Carl Christiansen' }],
    },
    {
      title: '2.2.2 Flisearbejde i badeværelser',
      description: 'Flisering af gulv og vægge (30x30cm) med epoxyfug. Overgang til vådrumsgulv med falde på 2%',
      status: 'To Do',
      dueDate: '2026-03-15',
      step: '2.2.2',
      estimatedHours: 32,
      assignees: [{ id: 'user_employee_01', initials: 'BB', name: 'Bente Bertelsen' }],
    },
    {
      title: '2.3.1 VVS installation bad',
      description: 'Montering af væghængt toilet, vask og integreret brusebakke',
      status: 'To Do',
      dueDate: '2026-03-20',
      step: '2.3.1',
      estimatedHours: 12,
      suggestedRegulations: [{ id: 'br18-kap20', title: 'BR18 Kap. 20: Vand' }],
      assignees: [{ id: 'user_external_01', initials: 'EE', name: 'El-Tech Elservice ApS' }],
    },
    // FASE 3: Lukning & Overflader
    {
      title: '3.1.1 Malerarbejde stue & entré',
      description: 'Pudsning af vægge, spartling af kigne og maling af lofter i stue og entrégang',
      status: 'Forfalden',
      dueDate: '2026-03-25',
      step: '3.1.1',
      estimatedHours: 24,
      assignees: [{ id: 'user_employee_02', initials: 'CC', name: 'Carl Christiansen' }],
    },
    {
      title: '3.1.2 Indpassning af vinduer fra facade',
      description: 'Montering af 3 nye træ/alu vinduer i stue, sådan at de passer med facaden',
      status: 'To Do',
      dueDate: '2026-04-05',
      step: '3.1.2',
      estimatedHours: 16,
      suggestedRegulations: [{ id: 'br18-kap11-door', title: 'BR18 Kap. 11: Energi' }],
      assignees: [{ id: 'user_employee_01', initials: 'BB', name: 'Bente Bertelsen' }],
    },
    {
      title: '3.2.1 Køkkeninstallation',
      description: 'Montering af indkøbskøkken inklusive hvidevarer og køkkenbelysning',
      status: 'To Do',
      dueDate: '2026-04-15',
      step: '3.2.1',
      estimatedHours: 12,
      assignees: [{ id: 'user_employee_02', initials: 'CC', name: 'Carl Christiansen' }],
    },
    {
      title: '3.2.2 Terrassedør og loftsvindue',
      description: 'Montering af 90cm bred terrassedør med glasindblanding samt loftsvindue i stue',
      status: 'To Do',
      dueDate: '2026-04-20',
      step: '3.2.2',
      estimatedHours: 10,
      assignees: [{ id: 'user_employee_01', initials: 'BB', name: 'Bente Bertelsen' }],
    },
    // FASE 4: Aflevering
    {
      title: '4.1.1 Indvendig malerarbejde',
      description: 'Slutmaling af alle indvendige overflader inklusiv døre og måtter',
      status: 'To Do',
      dueDate: '2026-04-30',
      step: '4.1.1',
      estimatedHours: 20,
      assignees: [{ id: 'user_employee_02', initials: 'CC', name: 'Carl Christiansen' }],
    },
    {
      title: '4.2.1 Facadeopdatering',
      description: 'Pudsning af facade og nye vindueskarm i træ/alu. Ferdigbehandling af sålbænke.',
      status: 'To Do',
      dueDate: '2026-05-10',
      step: '4.2.1',
      estimatedHours: 24,
      suggestedRegulations: [{ id: 'br18-kap5-escape', title: 'BR18 Kap. 5: Flugtveje' }],
      assignees: [{ id: 'user_employee_01', initials: 'BB', name: 'Bente Bertelsen' }],
    },
    {
      title: '4.3.1 Projektafløsnings kontrol',
      description: 'Endelig kontrol med klient, aflevering af dokumentation og garanti',
      status: 'To Do',
      dueDate: '2026-05-15',
      step: '4.3.1',
      estimatedHours: 6,
      suggestedRegulations: [{ id: 'br18-kap2', title: 'BR18 Kap. 2: Byggetilladelse' }],
      assignees: [{ id: 'user_manager_01', initials: 'AA', name: 'Anders Andersen' }],
    },
  ],
  purchases: [
    {
      name: 'Gipsplade 13mm',
      details: 'Lagsorteret, 1200x2500mm',
      quantity: 120,
      price: 89,
      status: 'Modtaget',
      supplier: 'Silvan',
      itemNumber: '321001',
    },
    {
      name: 'Træbjælke 45×95',
      details: 'Fyrretværsgruppe C24, 4,8m',
      quantity: 48,
      price: 38,
      status: 'Modtaget',
      supplier: 'Bauhaus',
      itemNumber: '663840',
    },
    {
      name: 'Vådrumsmembran 20m²',
      details: 'Kjærligergummi type, 2 lags',
      quantity: 3,
      price: 895,
      status: 'Bestilt',
      supplier: 'Stark',
      itemNumber: 'VR-20M2',
    },
    {
      name: 'Fliser 30x30cm hvid',
      details: 'Keramisk glat flise, 1,5m²/pk',
      quantity: 12,
      price: 189,
      status: 'Afventer',
      supplier: 'XL-Byg',
      itemNumber: 'FL-30X30-HV',
    },
    {
      name: 'LED spots 12V 3W',
      details: 'Kantrærs spots, inkl. fjernstyring',
      quantity: 16,
      price: 129,
      status: 'Afventer',
      supplier: 'El-Tech',
    },
    {
      name: 'Tagpap Base',
      details: '30m² rulle, undertag',
      quantity: 1,
      price: 499,
      status: 'Modtaget',
      supplier: 'Stark',
      itemNumber: '448899',
    },
    {
      name: 'Spartelmasse 10L',
      details: 'Fugtig spartel til fliser',
      quantity: 6,
      price: 249,
      status: 'Bestilt',
      supplier: 'Silvan',
      itemNumber: '990345',
    },
    {
      name: 'Træskrue 5×60 mm',
      details: 'Skruer til gipsvæg',
      quantity: 10,
      price: 149,
      status: 'Modtaget',
      supplier: 'Silvan',
      itemNumber: '874200',
    },
  ],
  documents: [
    {
      name: 'Tegning_01_Planskift.png',
      category: 'PLANNING_EXECUTION',
      isDrawing: true,
      discipline: 'ARCHITECTURE',
      drawingNo: 'A-101',
      revision: 'Rev. 2',
    },
    {
      name: 'Tegning_02_Elplan.png',
      category: 'TECHNICAL_DRAWINGS',
      isDrawing: true,
      discipline: 'ELECTRICAL',
      drawingNo: 'E-102',
      revision: 'Rev. 1',
    },
    {
      name: 'BR18_Kapitel_11_Energi.pdf',
      category: 'GENERAL',
      isDrawing: false,
    },
    {
      name: 'Byggetilladelse_Sag_2026-045.pdf',
      category: 'CONTRACT_LEGAL',
      isDrawing: false,
    },
    {
      name: 'Kontrakt_Med_Klient.pdf',
      category: 'CONTRACT_LEGAL',
      isDrawing: false,
    },
    {
      name: 'Fotos_Nedrivning_01.jpg',
      category: 'GENERAL',
      isDrawing: false,
    },
  ],
  reminders: [
    {
      title: 'Levering af fliser',
      dateTime: '2026-03-10T08:00:00',
      context: 'Kontakt XL-Byg ved levering af fliser til bad',
    },
    {
      title: 'Kontrol af vådrumsmembran',
      dateTime: '2026-03-06T14:00:00',
      context: 'Udført tryksøgning før flisering',
    },
  ],
  punchListLayouts: [
    {
      title: 'Plantegning - Villa Kildeskovgård 12',
      reference: 'A-101 / Demo plantegning',
      fileUrl: '/byggeapp/demo/plantegning.png',
    },
  ],
  punchListItems: [
    {
      layoutTitle: 'Plantegning - Villa Kildeskovgård 12',
      description: 'Mangler spartling omkring bruseniche - vådrumsmembran mangler på 10cm',
      status: 'Åben',
      pin: { x: 44, y: 66 },
      resolutionDueDate: '2026-03-18',
    },
    {
      layoutTitle: 'Plantegning - Villa Kildeskovgård 12',
      description: 'Dårlig fugning omkring WC - kræver ny installation',
      status: 'Kræver Supervisor',
      pin: { x: 12, y: 51 },
      resolutionDueDate: '2026-03-20',
    },
    {
      layoutTitle: 'Plantegning - Villa Kildeskovgård 12',
      description: 'Kontroller fald mod gulvafløb i bad før flisearbejde lukkes',
      status: 'I gang',
      pin: { x: 39, y: 67 },
      resolutionDueDate: '2026-03-21',
    },
  ],
  timeEntries: [
    {
      userId: 'user_employee_01',
      userName: 'Bente Bertelsen',
      hours: 8,
      date: '2026-02-10',
      description: 'Gipsvæg og stålstole',
    },
    {
      userId: 'user_employee_02',
      userName: 'Carl Christiansen',
      hours: 6,
      date: '2026-02-09',
      description: 'Midterdæk og væglængde',
    },
    {
      userId: 'user_manager_01',
      userName: 'Anders Andersen',
      hours: 4,
      date: '2026-02-08',
      description: 'Projektstyring og klientmøde',
    },
  ],
};

export default DEMO_PROJECT;
