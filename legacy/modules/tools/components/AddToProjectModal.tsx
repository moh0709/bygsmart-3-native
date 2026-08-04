import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingCartIcon, CheckSquareIcon } from '../../../components/icons';
import type { Project } from '../../../types';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { Button, Chip, Input, Modal, SegmentedControl, Select, Textarea } from '../../../components/ui';

interface AddToProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTitle: string;
    defaultValue: number;
    defaultUnit: string;
    initialType?: 'purchase' | 'task';
}

const TOOL_CATEGORIES: Record<string, { purchase: string[], task: string[] }> = {
    'areal-rumfang': {
        purchase: ['Byggematerialer generelt', 'Isolering', 'Plader', 'Trælast'],
        task: ['Opmåling', 'Arealberegning', 'Kvalitetssikring', 'Projektering']
    },
    'statiske-beregninger': {
        purchase: ['Stål', 'Bjælker', 'Søjler', 'Beslag', 'Konstruktionstræ'],
        task: ['Dimensionering', 'Statisk dokumentation', 'Tilsyn', 'Montage']
    },
    'gulve-overflader': {
        purchase: ['Gulvbrædder', 'Fliser', 'Mørtel/Lim', 'Underlag', 'Maling', 'Fugemasse'],
        task: ['Gulvlægning', 'Flisearbejde', 'Afslibning', 'Maling', 'Fugning']
    },
    'vaegge-skillevaegge': {
        purchase: ['Mursten', 'Gipsplader', 'Stolper/Skinner', 'Isolering', 'Maling', 'Puds/Spartel'],
        task: ['Opmuring', 'Vægmontage', 'Spartling', 'Maling', 'Isolering']
    },
    'lofter-tag': {
        purchase: ['Tagsten/Plader', 'Spærtræ', 'Isolering', 'Lægter', 'Tagrender', 'Understrygning'],
        task: ['Tagdækning', 'Rejsning af spær', 'Loftmontage', 'Isolering', 'Tagrender']
    },
    'doere-vinduer': {
        purchase: ['Vinduer', 'Døre', 'Fugemasse', 'Beslag', 'Gerigter/Lister'],
        task: ['Udskiftning af vinduer', 'Montering af døre', 'Fugning', 'Justering', 'Glasarbejde']
    },
    'vvs': {
        purchase: ['Rør & Fittings', 'Sanitet', 'Varmeanlæg', 'Pumper', 'Afløbsdele'],
        task: ['Rørføring', 'Installation af sanitet', 'Gulvvarme', 'Service', 'Fejlfinding']
    },
    'el': {
        purchase: ['Kabler', 'Kontakter/Afbrydere', 'Armaturer', 'Sikringer', 'Solceller'],
        task: ['Kabeltræk', 'Montering af materiel', 'Fejlfinding', 'Tilslutning', 'Idriftsættelse']
    },
    'hvac': {
        purchase: ['Ventilationsrør', 'Aggregat', 'Riste', 'Ventilatorer', 'Filtre'],
        task: ['Montage af ventilation', 'Indregulering', 'Rensning', 'Service']
    },
    'beton-armering': {
        purchase: ['Færdigbeton', 'Cement/Grus', 'Armeringsjern', 'Forskalling', 'Fundablokke'],
        task: ['Støbning', 'Armering', 'Forskalling', 'Udgravning', 'Fundering']
    },
    'udgravning-jord': {
        purchase: ['Grus/Sand', 'Jord', 'Geotekstil', 'Rør', 'Fyld'],
        task: ['Udgravning', 'Bortkørsel', 'Jordflytning', 'Komprimering', 'Nivellering']
    },
    'trapper': {
        purchase: ['Trappeelementer', 'Vanger/Trin', 'Gelænder', 'Beslag'],
        task: ['Trappemontage', 'Opmåling', 'Renovering', 'Sikkerhedstjek']
    },
    'energi-klima': {
        purchase: ['Isolering', 'Tætningsmaterialer', 'Dampspærre', 'Vindspærre'],
        task: ['Energirenovering', 'Tæthedsprøvning', 'Isolering', 'Termografering']
    },
    'udenomsarealer': {
        purchase: ['Belægningssten', 'Grus/Sand', 'Hegn', 'Planter', 'Stolper'],
        task: ['Belægningsarbejde', 'Haveanlæg', 'Hegnsopsætning', 'Jordarbejde']
    },
    'geometri': {
        purchase: ['Måleudstyr', 'Snore/Afsætning'],
        task: ['Afsætning', 'Opmåling', 'Kontrolmåling']
    },
    'pris-budget': {
        purchase: ['Diverse materialer'],
        task: ['Budgetlægning', 'Tilbudsgivning', 'Fakturering']
    }
};

const AddToProjectModal: React.FC<AddToProjectModalProps> = ({ isOpen, onClose, defaultTitle, defaultValue, defaultUnit, initialType = 'purchase' }) => {
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const location = useLocation();
    const [type, setType] = useState<'purchase' | 'task'>(initialType);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [title, setTitle] = useState(defaultTitle);
    // A calculator result denominated in kr. is a price, not a physical quantity —
    // save it as price×1 instead of stuffing it into quantity with price left at 0.
    const isMonetaryResult = /kr\.?$/i.test(defaultUnit.trim());
    const [quantity, setQuantity] = useState(isMonetaryResult ? '1' : defaultValue.toString());
    const [price, setPrice] = useState(isMonetaryResult ? defaultValue.toString() : '0');
    const [details, setDetails] = useState(`Beregnet resultat: ${defaultValue} ${defaultUnit}`);
    const [category, setCategory] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Determine current tool category from URL
    const currentToolCategory = useMemo(() => {
        const pathParts = location.pathname.split('/');
        if (pathParts.length > 2 && pathParts[1] === 'tools') {
            return pathParts[2];
        }
        return null;
    }, [location.pathname]);

    const categorySuggestions = useMemo(() => {
        if (currentToolCategory && TOOL_CATEGORIES[currentToolCategory]) {
            return TOOL_CATEGORIES[currentToolCategory][type];
        }
        return [];
    }, [currentToolCategory, type]);

    useEffect(() => {
        const fetchProjects = async () => {
            // Eager-chunk rule: projects barrel only via dynamic import here.
            const { getProjects } = await import('../../projects');
            const data = await getProjects();
            setProjects(data);
            const active = data.find(p => p.status === 'I gang');
            if (active) setSelectedProjectId(active.id);
            else if (data.length > 0) setSelectedProjectId(data[0].id);
        };
        if (isOpen && isAuthenticated) {
            fetchProjects();
            setType(initialType);

            // Set default category if available
            if (currentToolCategory && TOOL_CATEGORIES[currentToolCategory]) {
                setCategory(TOOL_CATEGORIES[currentToolCategory][type][0] || '');
            }
        }
    }, [isOpen, isAuthenticated, initialType, currentToolCategory, type]);

    const handleSave = async () => {
        if (!selectedProjectId) return;
        setIsSaving(true);

        try {
            if (type === 'purchase') {
                // Loaded on demand: a static barrel import would drag the purchasing
                // module's components into the eagerly-preloaded calculators chunk.
                const { createPurchaseItemForProject } = await import('../../purchasing');
                await createPurchaseItemForProject(selectedProjectId, {
                    name: title,
                    quantity: parseFloat(quantity) || 0,
                    details: `${details} \nKategori: ${category}`,
                    price: parseFloat(price) || 0,
                    status: 'Afventer'
                });
            } else {
                // Same eager-chunk rule as purchasing above: import the tasks
                // barrel at the call site so calculators-pages stays lean.
                const { createTaskForProject } = await import('../../tasks');
                await createTaskForProject(selectedProjectId, {
                    title: title,
                    description: `${details} \nKategori: ${category}`,
                    status: 'To Do',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'), // Due in 1 week
                    assignees: []
                });
            }
            onClose();
            showToast(type === 'purchase' ? 'Tilføjet til indkøbsliste.' : 'Opgave oprettet.', 'success');
        } catch (error) {
            console.error("Failed to save item", error);
            showToast('Der opstod en fejl. Prøv igen.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Gem til projekt"
            size="sm"
            footer={
                <Button
                    fullWidth
                    onClick={handleSave}
                    loading={isSaving}
                    disabled={!selectedProjectId}
                    iconLeft={type === 'purchase' ? <ShoppingCartIcon className="w-5 h-5" /> : <CheckSquareIcon className="w-5 h-5" />}
                    aria-label={type === 'purchase' ? 'Tilføj til indkøbsliste' : 'Opret opgave'}
                >
                    {type === 'purchase' ? 'Tilføj til indkøbsliste' : 'Opret opgave'}
                </Button>
            }
        >
            <div className="space-y-4">
                {/* Project selector */}
                <Select
                    label="Vælg projekt"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                    {projects.length === 0 && <option value="">Ingen projekter fundet</option>}
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </Select>

                {/* Type switcher */}
                <SegmentedControl
                    label="Type"
                    options={[
                        { label: 'Indkøb', value: 'purchase', icon: <ShoppingCartIcon className="w-4 h-4" /> },
                        { label: 'Opgave', value: 'task', icon: <CheckSquareIcon className="w-4 h-4" /> },
                    ]}
                    value={type}
                    onChange={(value) => setType(value as 'purchase' | 'task')}
                />

                <Input
                    label="Titel"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                {type === 'purchase' && isMonetaryResult && (
                    <Input
                        label="Pris (kr.)"
                        type="number"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                    />
                )}

                {type === 'purchase' && !isMonetaryResult && (
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <Input
                                label="Mængde"
                                type="number"
                                inputMode="decimal"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                        </div>
                        <span className="h-11 min-w-[5rem] px-3 inline-flex items-center justify-center rounded-control bg-bg-muted dark:bg-bg-dark-muted text-label font-semibold text-text-secondary dark:text-text-dark-secondary shrink-0">
                            {defaultUnit || 'stk'}
                        </span>
                    </div>
                )}

                <div>
                    <Input
                        label="Kategori"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="F.eks. Materialer"
                    />
                    {categorySuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {categorySuggestions.map(cat => (
                                <Chip
                                    key={cat}
                                    selected={category === cat}
                                    onClick={() => setCategory(cat)}
                                >
                                    {cat}
                                </Chip>
                            ))}
                        </div>
                    )}
                </div>

                <Textarea
                    label="Noter"
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="resize-none"
                />
            </div>
        </Modal>
    );
};

export default AddToProjectModal;
