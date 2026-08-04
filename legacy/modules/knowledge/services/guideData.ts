
import React from 'react';
import {
    BuildingIcon,
    FireIcon,
    LayersIcon,
    WaveformIcon,
} from '../../../components/icons';

export interface Guide {
  id: string;
  title: string;
  description: string;
  icon: React.FC<{className?: string}>;
  guideSteps: { title: string; content: string }[];
  recommendations: string[];
  regulations: {
    id: string;
    title: string;
    rules: string[];
  }[];
}

export const guides: Guide[] = [
  {
    id: 'dor',
    title: 'Montering af Indvendig Dør',
    description: 'En trin-for-trin guide til korrekt installation af indvendige døre, med fokus på tæthed, finish og eventuelle brandkrav.',
    icon: BuildingIcon,
    guideSteps: [
      { title: '1. Opmåling og Forberedelse', content: 'Kontroller murhullets dimensioner, og sørg for, at det er i lod og vater. Dørkarmen skal være ca. 12mm mindre i bredde og 6mm mindre i højde end hullet for at give plads til justering og fugning.' },
      { title: '2. Montering af Karm', content: 'Placer karmen i hullet og fastgør den midlertidigt med kiler. Brug et vaterpas til at sikre, at karmen er i perfekt lod og vater på alle leder. Fastgør karmen permanent med karmskruer.' },
      { title: '3. Montering af Dørplade', content: 'Hæng dørpladen på hængslerne. Kontroller afstanden mellem dørplade og karm – den skal være ens hele vejen rundt (typisk 3-4 mm).' },
      { title: '4. Justering og Fugning', content: 'Juster hængslerne for at opnå en jævn afstand. Når alt er justeret, fuges mellemrummet mellem karm og mur med isoleringsmateriale og afsluttes med en passende fugemasse eller gerigter.' },
    ],
    recommendations: [
      'Brug karmskruer i stedet for dyvler og skruer for nemmere justering.',
      'For branddøre skal du altid følge producentens specifikke monteringsvejledning og bruge brandhæmmende fugematerialer.',
      'Kontroller dørpladens retning, inden du monterer håndtag og lås.',
    ],
    regulations: [
      {
        id: 'br18-kap5-112',
        title: 'BR18, Kap. 5, § 112 - Flugtveje',
        rules: [
          'Døre i flugtveje skal have en fri passagebredde på mindst 0,77 m.',
          'Døre skal være lette at åbne uden brug af nøgle eller særligt værktøj.',
        ],
      },
      {
        id: 'br18-kap5-125',
        title: 'BR18, Kap. 5 - Branddøre',
        rules: [
          'Branddøre skal klassificeres og monteres i henhold til DS/EN 16034.',
          'Sørg for korrekt dokumentation for branddørens ydeevne og montering.',
        ],
      },
    ],
  },
  {
    id: 'skillevaeg',
    title: 'Opbygning af Let Skillevæg',
    description: 'Vejledning til opbygning af en standard let skillevæg med stål- eller træskelet og gipsplader, der opfylder gængse lyd- og brandkrav.',
    icon: LayersIcon,
    guideSteps: [
        { title: '1. Skeletkonstruktion', content: 'Monter top- og bundskinner (stål) eller lægter (træ). Placer stolperne med en centerafstand på 45 eller 60 cm, afhængigt af gipspladernes bredde. Sørg for at skelettet er i lod.' },
        { title: '2. Installationer', content: 'Før eventuelle el- og VVS-installationer i væggens hulrum. Monter dåser og rør, inden væggen lukkes.' },
        { title: '3. Isolering', content: 'Udfyld hulrummet med isoleringsmateriale (f.eks. mineraluld) for at forbedre lyd- og brandisolering. Sørg for, at isoleringen er tætsluttende.' },
        { title: '4. Montering af Gipsplader', content: 'Monter første lag gipsplader. Forskyd samlingerne på andet lag for at opnå bedre stabilitet og lydisolering. Brug korrekte gipsskruer med passende afstand.' },
        { title: '5. Spartling og Finish', content: 'Spartl alle samlinger og skruehuller i flere omgange. Slib overfladen jævn, og afslut med den ønskede overfladebehandling (maling, tapet, etc.).' }
    ],
    recommendations: [
        'Brug altid to lag gips på hver side for at opnå standard lyd- og brandkrav (f.eks. REI 60 / 53 dB).',
        'Anvend en fugemembran eller tætningsliste under bundskinnen for at forhindre flanketransmission af lyd.',
        'Husk at forskydde pladesamlingerne mellem de to sider af væggen.'
    ],
    regulations: [
        { id: 'br18-kap17', title: 'BR18, Kap. 17 - Lydforhold', rules: ['Vægge mellem boligenheder skal mindst opfylde lydklasse C.', 'Luftlydisolation R\'w skal typisk være ≥ 53 dB.'] },
        { id: 'br18-kap5-82', title: 'BR18, Kap. 5 - Brandforhold', rules: ['Bærende skillevægge skal have en brandmodstandsevne på mindst R 60.', 'Ikke-bærende adskillende vægge skal typisk have en klassifikation på EI 60.'] }
    ]
  },
  {
    id: 'loft',
    title: 'Opsætning af Nedsænket Loft',
    description: 'Guide til installation af nedsænkede lofter, herunder skelet, isolering og beklædning for at forbedre akustik, brandforhold eller skjule installationer.',
    icon: BuildingIcon,
    guideSteps: [
        { title: '1. Planlægning og Opmærkning', content: 'Bestem den ønskede lofthøjde og marker den på væggene med en laser eller rettesnor. Planlæg placeringen af ophæng og skelet.' },
        { title: '2. Montering af Ophæng', content: 'Fastgør justerbare ophæng eller stropper til det eksisterende loft. Afstanden mellem ophængene afhænger af systemet, men er typisk omkring 80-120 cm.' },
        { title: '3. Opsætning af Skelet', content: 'Monter det primære og sekundære skelet (f.eks. stålprofiler eller trælægter) i ophængene. Juster skelettet, så det er i perfekt vater.' },
        { title: '4. Dampspærre og Isolering', content: 'Hvis nødvendigt, monter en tæt dampspærre over skelettet. Læg derefter isolering mellem profilerne for at forbedre termisk og akustisk ydeevne.' },
        { title: '5. Montering af Loftbeklædning', content: 'Skru loftpladerne (f.eks. gips eller akustikplader) fast på skelettet. Forskyd samlingerne for at opnå en stærkere overflade. Afslut med spartling og maling.' }
    ],
    recommendations: [
        'Overvej et akustikloft (med perforerede plader) i rum med dårlig akustik.',
        'Husk at planlægge for indbygningsspots og ventilation, inden loftet lukkes.',
        'Brug altid en gipspladehejs ved montering af gipslofter for at lette arbejdet og sikre korrekt installation.'
    ],
    regulations: [
        { id: 'br18-kap11', title: 'BR18, Kap. 11 - Isolering', rules: ['Loftkonstruktioner mod det fri skal overholde U-værdi krav.', 'Dampspærren skal være tæt for at forhindre fugtskader.'] },
        { id: 'br18-kap5-125', title: 'BR18, Kap. 5 - Brandtekniske Installationer', rules: ['Sørg for, at indbyggede installationer som spots ikke forringer brandmodstandsevnen.', 'Brug brandklassificerede inspektionslemme, hvor det er nødvendigt.'] }
    ]
  },
  {
    id: 'gennemforing',
    title: 'Brandtætning af Gennemføringer',
    description: 'Korrekt udførelse af brandtætninger for rør- og kabelgennemføringer i brandadskillende bygningsdele for at opretholde brandintegriteten.',
    icon: WaveformIcon,
    guideSteps: [
        { title: '1. Identificer Krav', content: 'Bestem brandkravet for bygningsdelen (f.eks. EI 60). Vælg et tætningsprodukt, der er godkendt til den specifikke type gennemføring (kabel, plastrør, metalrør) og bygningsdel.' },
        { title: '2. Forberedelse af Hul', content: 'Sørg for, at hullet omkring gennemføringen er rent, tørt og fri for løse partikler. Respekter de minimale og maksimale åbningsstørrelser, som er specificeret for produktet.' },
        { title: '3. Montering af Bagstop', content: 'Hvis påkrævet af producenten, installeres en bagstop af ubrændbart materiale (f.eks. stenuld) for at sikre korrekt dybde af fugemassen.' },
        { title: '4. Anvendelse af Tætningsprodukt', content: 'Påfør brandtætningsproduktet (f.eks. fugemasse, manchet, brik) i henhold til producentens anvisninger. Sørg for fuld dækning og korrekt tykkelse.' },
        { title: '5. Dokumentation', content: 'Fotografer den færdige tætning og mærk den med et skilt, der angiver produkt, brandklasse og installatørens navn. Gem al dokumentation for fremtidig reference.' }
    ],
    recommendations: [
        'Brug altid produkter, der er ETA-godkendt og testet i henhold til EN 1366-3.',
        'Kombiner aldrig forskellige producenters produkter i den samme tætning.',
        'Efteruddannelse i passiv brandsikring anbefales for alle, der udfører brandtætninger.'
    ],
    regulations: [
        { id: 'br18-kap5-125', title: 'BR18, Kap. 5, § 125 - Brandtekniske Installationer', rules: ['Gennemføringer for installationer skal udføres, så bygningsdelens brandtekniske egenskaber ikke forringes.', 'Dokumentation for korrekt udførelse skal foreligge.'] }
    ]
  },
  {
    id: 'trappe',
    title: 'Installation af Trapper',
    description: 'Vejledning til sikker og korrekt installation af trapper, der overholder kravene til stigning, grund og frihøjde.',
    icon: BuildingIcon,
    guideSteps: [
        { title: '1. Kontrol af Mål', content: 'Verificer, at trappehullets dimensioner stemmer overens med trappens specifikationer. Kontroller etagehøjden fra færdigt gulv til færdigt gulv.' },
        { title: '2. Fastgørelse af Vanger', content: 'Fastgør trappens vanger solidt til de bærende bygningsdele i top og bund. Brug kraftige skruer eller bolte som specificeret af producenten.' },
        { title: '3. Montering af Trin og Stødtrin', content: 'Monter trin og eventuelle stødtrin. Sørg for, at de er i vater og fastgjort korrekt til vangerne for at undgå knirkelyde.' },
        { title: '4. Opsætning af Værn og Håndliste', content: 'Installer balustre og håndliste. Højden på værnet skal typisk være mindst 0,9 m. Sørg for, at alle samlinger er stabile og sikre.' }
    ],
    recommendations: [
        'Trappeformlen (2 x stigning + 1 x grund) bør ligge mellem 610 og 630 mm for en komfortabel trappe.',
        'Sørg for en frihøjde på mindst 2,0 m over hele trappeforløbet.',
        'Ved trapper i fælles adgangsveje er der skærpede krav til bredde og dimensioner.'
    ],
    regulations: [
        { id: 'br18-kap5-112', title: 'BR18, Kap. 5, § 112 - Flugtveje', rules: ['Trapper i flugtveje skal have en fri bredde på mindst 1,0 m.', 'Der må ikke være døre, der åbner ud over trappen.'] },
    ]
  },
  {
    id: 'flugtvej',
    title: 'Etablering af Flugtveje',
    description: 'Overblik over de vigtigste krav til design og udførelse af sikre flugtveje, der sikrer hurtig og sikker evakuering i tilfælde af brand.',
    icon: FireIcon,
    guideSteps: [
        { title: '1. Flugtvejskorridorer', content: 'Sørg for, at flugtvejskorridorer har den påkrævede frie bredde (typisk mindst 1,3 m) og er fri for brandbare materialer og oplag.' },
        { title: '2. Flugtvejstrapper', content: 'Trapper i flugtveje skal være udført som lukkede trapperum (ofte som et trapperum klasse 1 eller 2), beklædt med brandhæmmende materialer.' },
        { title: '3. Redningsåbninger', content: 'Sørg for, at der er redningsåbninger (vinduer eller døre) i alle beboelsesrum og i rum, hvor personer kan forventes at opholde sig i længere tid. Åbningen skal være let at betjene og have en fri højde + bredde på mindst 1,5 m.' },
        { title: '4. Skiltning og Belysning', content: 'Installer panikbelysning og flugtvejsskiltning i henhold til gældende standarder for at guide personer sikkert ud af bygningen.' }
    ],
    recommendations: [
        'Den maksimale gåafstand til nærmeste udgang afhænger af bygningens anvendelseskategori og brandklasse.',
        'Overflader i flugtveje skal som minimum have en brandbeskyttelsesbeklædning klasse K1 10 D-s2,d2.',
        'Rådfør dig altid med en brandrådgiver ved komplekse byggerier.'
    ],
    regulations: [
        { id: 'br18-kap5-112', title: 'BR18, Kap. 5, § 112 - Flugtveje og Redningsåbninger', rules: ['Der skal være mindst to af hinanden uafhængige flugtveje fra de fleste rum.', 'Redningsåbningers frie højde skal være mindst 0,6 m og frie bredde mindst 0,5 m.'] }
    ]
  }
];

export const getGuideById = (id: string): Guide | undefined => {
    return guides.find(g => g.id === id);
}
