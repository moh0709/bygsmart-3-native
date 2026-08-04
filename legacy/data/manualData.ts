
import { 
    UserIcon, 
    FolderIcon, 
    CalculatorIcon, 
    SparklesIcon, 
    SettingsIcon, 
    CheckSquareIcon,
    FileTextIcon,
    UsersIcon,
    ClockIcon,
    ShoppingCartIcon,
    AlertTriangleIcon,
    BuildingIcon,
    MapPinIcon,
    LayersIcon
} from '../components/icons';

export interface ManualSection {
    id: string;
    title: string;
    icon: any;
    articles: {
        title: string;
        content: string; // Supports basic markdown-like bullet points with * and bold with **
    }[];
}

export const manualData: ManualSection[] = [
    {
        id: 'start',
        title: 'Kom godt i gang',
        icon: FileTextIcon,
        articles: [
            {
                title: 'Hvad er BYG SMART?',
                content: 'BYG SMART er den ultimative digitale værktøjskasse for håndværkere og entreprenører. Appen samler projektstyring, lovgivning (BR18), tidsregistrering og avancerede beregnere i én samlet løsning.\n\n**Nøglefunktioner:**\n* **Offline-first:** Virker ude på pladsen, selv uden internet.\n* **AI Assistent:** Hjælper med beregninger, opslag i reglementer og oprettelse af opgaver.\n* **Samarbejde:** Inviter kollegaer, underentreprenører og bygherrer med differentieret adgang.'
            },
            {
                title: 'Installation (App)',
                content: 'BYG SMART er en "Progressive Web App" (PWA). Det betyder, du ikke skal hente den i App Store, men installere den direkte fra din browser for at få fuld skærm og offline funktionalitet.\n\n**iPhone / iPad (iOS):**\n1. Åbn appen i Safari.\n2. Tryk på "Del"-ikonet (firkant med pil op) i bunden.\n3. Scroll ned og vælg **"Føj til hjemmeskærm"**.\n4. Tryk "Tilføj".\n\n**Android (Chrome):**\n1. Åbn appen i Chrome.\n2. Tryk på menuen (tre prikker) i toppen.\n3. Vælg **"Installer app"** eller **"Føj til startskærm"**.\n\nNu ligger appen som et ikon på din telefon og virker præcis som en almindelig app.'
            },
            {
                title: 'Opsætning af Profil',
                content: 'Før du går i gang, anbefales det at opsætte din profil under **Indstillinger** (tandhjulet).\n\n1. **Cloud Integration:** Forbind til Google Drive, Dropbox eller OneDrive. Dette er *nødvendigt* for at kunne gemme tegninger og eksportere PDF-rapporter direkte til din firmadisk.\n2. **Initialer:** Sørg for dine initialer (f.eks. "AA") er korrekte, da de vises på tidsplaner og opgaver.\n3. **Tema:** Du kan vælge mellem Lys, Mørk eller System-tema afhængigt af, om du står i høj sol eller arbejder om aftenen.'
            }
        ]
    },
    {
        id: 'roles',
        title: 'Roller & Samarbejde',
        icon: UsersIcon,
        articles: [
            {
                title: 'Oversigt over Roller',
                content: 'Sikkerhed er nøglen i BYG SMART. Vi arbejder med 5 forskellige roller, der bestemmer, hvad en bruger kan se og gøre. Det sikrer, at interne data (som økonomi) forbliver interne.\n\n**1. Owner (Mester):**\n* Fuld adgang til alt.\n* Kan se økonomi, budgetter og slette projekter.\n* Kan invitere og fjerne brugere.\n\n**2. Manager (Formand):**\n* Kan lede projekter og oprette opgaver.\n* Kan godkende timer.\n* Kan IKKE slette projekter eller se overordnede firmaindstillinger.\n\n**3. Employee (Svend/Medarbejder):**\n* Har adgang til alle opgaver, tegninger og tidsregistrering på projektet.\n* Kan IKKE se budgetter, priser eller invitere andre.\n\n**4. External (Underentreprenør):**\n* **Begrænset adgang.**\n* Kan KUN se de specifikke opgaver, der er tildelt direkte til dem.\n* Ser ingen andre opgaver, ingen økonomi og ingen fælles dokumenter, medmindre de er vedhæftet deres opgave.\n\n**5. Client (Bygherre):**\n* **Læseadgang.**\n* Kan se tidsplan (Gantt), fremskridt (%) og udvalgte dokumenter.\n* Kan ikke se interne noter, budgetter eller medarbejder-detaljer.'
            },
            {
                title: 'Inviter en bruger',
                content: 'For at invitere en person til et projekt:\n\n1. Åbn projektet og gå til fanen **Detaljer**.\n2. Scroll ned til sektionen "Team" og tryk på **Tilføj**.\n3. Vælg enten en person fra dit eksisterende netværk eller indtast en email.\n4. **VIGTIGT:** Vælg den korrekte rolle i dropdown-menuen. Er du i tvivl, så start med "External" eller "Employee" for at beskytte dine data.'
            },
            {
                title: 'Netværk & Forbindelser',
                content: 'Under **Indstillinger -> Mit Netværk** kan du opbygge en liste over faste samarbejdspartnere. \n\nNår du har forbundet dig med en kollega her, kan du hurtigt tilføje dem til nye projekter uden at skulle indtaste deres email hver gang.'
            }
        ]
    },
    {
        id: 'projects',
        title: 'Projektstyring',
        icon: FolderIcon,
        articles: [
            {
                title: 'AI Onboarding (Opret Projekt)',
                content: 'Den hurtigste måde at starte et projekt på er via **AI Onboarding**. Tryk på "Nyt Projekt" og vælg "AI Onboarding".\n\n**Trin-for-trin:**\n1. **Omfang:** Vælg zonen (f.eks. "Tag", "Facade", "Kælder").\n2. **Beskrivelse:** Indtal en besked eller upload et tilbud (PDF/Billede). AI\'en læser det og udtrækker detaljer.\n3. **Værktøjer:** AI\'en foreslår relevante beregnere (f.eks. tagareal). Udfyld tallene her for at få mængder.\n4. **Regler:** AI\'en finder relevante BR18-krav.\n5. **Planlægning:** AI\'en genererer automatisk en tidsplan og en materialeliste baseret på dine input.\n\nDu kan redigere alt, før du godkender og opretter projektet.'
            },
            {
                title: 'Tidsplanlægning (Gantt)',
                content: 'Gå til siden **Projekter** og skift visning til "Planlægning" i toppen.\n\n* **Gantt-kort:** Viser alle dine projekter på en tidslinje. Du kan zoome ind på Uge, Måned eller Kvartal.\n* **Udvid:** Klik på pilen ud for et projekt for at se de enkelte opgaver og deres varighed.\n* **Status:** Farverne indikerer status (Blå = I gang, Grøn = Færdig, Rød = Forsinket).\n\nDette værktøj er uundværligt for at se, om du har overbooket mandskabet i en given uge.'
            },
            {
                title: 'Overdragelsesrapport',
                content: 'Når projektet er færdigt, kan du lave en professionel rapport til bygherren på sekunder.\n\n1. Gå til projektets **Overblik** fane.\n2. Tryk på knappen **"Overdragelse"**.\n3. AI\'en analyserer hele projektets historik, udførte opgaver og eventuelle åbne mangler.\n4. Den genererer en PDF med resumé, status og garantierklæring, klar til underskrift.\n\nRapporten gemmes automatisk under "Dokumenter" og kan sendes via email.'
            }
        ]
    },
    {
        id: 'tasks',
        title: 'Opgaver & Kvalitetssikring',
        icon: CheckSquareIcon,
        articles: [
            {
                title: 'Opgavedetaljer',
                content: 'En opgave indeholder alt, hvad svenden skal bruge:\n* **Beskrivelse:** Hvad skal laves?\n* **Billeder:** Før/efter dokumentation.\n* **Tjeklister:** Konkrete punkter der SKAL krydses af (f.eks. "Dampspærre tapet").\n* **Reglementer:** Direkte links til BR18-krav relevante for opgaven.\n\nHvis du vælger "Markér som milepæl", vil opgaven fremgå tydeligt på tidslinjen med en diamant-markør.'
            },
            {
                title: 'Punch List (Mangelgennemgang)',
                content: 'Punch List værktøjet bruges til KS (Kvalitetssikring) og gennemgang.\n\n1. Gå til fanen **Punch List** i et projekt.\n2. **Upload plantegning:** Læg en tegning op af huset.\n3. **Sæt nåle:** Tryk på tegningen, hvor der er en fejl (f.eks. "Ridse i karm").\n4. **Dokumenter:** Tag et billede og beskriv fejlen.\n5. **Rapport:** Tryk på "Rapport" for at generere en PDF med tegningen og alle punkter med billeder, klar til at sende til underentreprenøren.'
            },
            {
                title: 'AI Optimering af Opgaver',
                content: 'Når du opretter en opgave, kan du skrive en kort, rodet tekst (f.eks. "Fix vinduet i stuen, det binder").\n\nTryk på **AI-knappen** (stjernen). AI\'en vil omskrive teksten til en professionel instruks: *"Justering af vindue i stue. Kontroller hængsler og slutblik. Smør bevægelige dele."*'
            }
        ]
    },
    {
        id: 'tools',
        title: 'Værktøjer & Beregnere',
        icon: CalculatorIcon,
        articles: [
            {
                title: 'Oversigt over Beregnere',
                content: 'BYG SMART indeholder over 20 specialiserede beregnere opdelt i kategorier:\n\n* **Areal & Rumfang:** Gulv, væg, tag, udgravning.\n* **Statiske Beregninger (Pro):** Bjælkebelastning, søjler, spær.\n* **Energi & Klima:** U-værdi (Varmetab), Dugpunkt, CO2.\n* **Materialer:** Maling, fliser, gips, beton, reglar.\n* **VVS & El:** Rørdimension, kabelstørrelse, varmetab.\n* **Udearealer:** Belægning, hegn, fald på terræn.'
            },
            {
                title: 'Gem til Projekt',
                content: 'Når du har lavet en beregning (f.eks. beregnet mængden af maling), kan du trykke på knappen **"Gem til Projekt"**.\n\nHer kan du vælge:\n* **Opgave:** Opret en opgave ("Mal stue") med de beregnede mængder i beskrivelsen.\n* **Indkøb:** Læg materialerne (f.eks. "Maling, 20L") direkte i projektets indkøbskurv.\n\nDu kan også eksportere beregningen som en PDF-dokumentation til bygherren.'
            },
            {
                title: 'Pro Værktøjer',
                content: 'Værktøjer markeret med **(Pro)** indeholder avanceret ingeniør-logik. F.eks. *Bjælkebelastning*, der beregner moment og nedbøjning. Disse kræver et aktivt abonnement. Husk altid, at disse beregninger er vejledende overslag og ikke erstatter en certificeret statiker ved kritiske konstruktioner.'
            }
        ]
    },
    {
        id: 'ai',
        title: 'AI & Assistent',
        icon: SparklesIcon,
        articles: [
            {
                title: 'Chatbotten (Din makker)',
                content: 'I bunden af skærmen finder du altid AI-ikonet. Du kan spørge om alt byggeteknisk:\n\n* "Hvad er kravene til redningsåbning?"\n* "Hvordan blander jeg mørtel 1:4?"\n* "Find sagen på Strandvejen frem."\n\nAI\'en kender konteksten. Hvis du står inde på et projekt, ved den, hvilket projekt du taler om.'
            },
            {
                title: 'Hands-free Mode',
                content: 'Perfekt når du står på stigen eller har beskidte hænder.\n\n1. Åbn chatten og tryk på **Mikrofon-ikonet**.\n2. Sig din kommando, f.eks.: *"Opret en opgave: Husk at bestille container til i morgen."*\n3. AI\'en bekræfter med tale: *"Opgave oprettet."*\n\nDu behøver ikke røre skærmen.'
            },
            {
                title: 'Snap & Mål (Billedanalyse)',
                content: 'Tag et billede af en bygningsdel via chatten (Kamera-ikonet). Spørg derefter:\n\n* "Hvilken type murværk er dette?"\n* "Estimer materialer til at reparere denne skade."\n* "Mål vinduets dimensioner." (Kræver referenceobjekt).\n\nAI\'en analyserer billedet og giver dig teknisk feedback.'
            }
        ]
    },
    {
        id: 'time',
        title: 'Tid & Økonomi',
        icon: ClockIcon,
        articles: [
            {
                title: 'Tidsregistrering',
                content: 'Under fanen **Tid & Plan** i et projekt:\n\n* **Stopur:** Start/Stop tid mens du arbejder. Du kan minimere appen, tiden tæller videre.\n* **Manuelt:** Indtast timer bagefter, hvis du glemte det.\n\nSom Mester/Manager kan du se fanen **Oversigt**, der viser "Burn Rate" (hvor hurtigt budgettet bruges) og hvem der bruger timerne.'
            },
            {
                title: 'Indkøbsstyring',
                content: 'Under fanen **Indkøb** kan du styre materialer.\n\n* Opret varer manuelt eller via beregnere.\n* Skift status: **Afventer -> Bestilt -> Modtaget**.\n* Upload følgesedler (billede) direkte på indkøbslinjen for dokumentation.'
            }
        ]
    },
    {
        id: 'settings',
        title: 'Sikkerhed & Data',
        icon: AlertTriangleIcon,
        articles: [
            {
                title: 'Offline Data',
                content: 'Appen er "Offline First". Det betyder, at du kan arbejde i kældre uden dækning. Alle data gemmes lokalt på din telefon. Når du får netforbindelse igen, synkroniseres ændringerne automatisk til skyen.'
            },
            {
                title: 'Datasikkerhed',
                content: 'Vi deler ikke dine projektdata med tredjepart. Dine tegninger og beregninger er dine. AI-analyser (Gemini) behandles sikkert via Googles Enterprise API og bruges ikke til at træne offentlige modeller med dine specifikke data.'
            }
        ]
    }
];
