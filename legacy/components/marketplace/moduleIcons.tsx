import type React from 'react';
import type { ModuleId } from '../../core/registry/types';
import {
    FolderIcon, CheckSquareIcon, CalculatorIcon, SearchIcon, ClipboardListIcon,
    CheckCircleIcon, ClockIcon, CalendarIcon, FileTextIcon, UsersIcon,
    TrendingUpIcon, ShoppingCartIcon, LayersIcon, LinkIcon, PieChartIcon,
    EyeIcon, SparklesIcon, CameraIcon, CloudIcon,
} from '../icons';

/** Marketplace icon per module (existing icon set only). */
export const MODULE_ICONS: Record<ModuleId, React.FC<{ className?: string }>> = {
    projects: FolderIcon,
    tasks: CheckSquareIcon,
    tools: CalculatorIcon,
    knowledge: SearchIcon,
    field: ClipboardListIcon,
    quality: CheckCircleIcon,
    time: ClockIcon,
    planning: CalendarIcon,
    documents: FileTextIcon,
    team: UsersIcon,
    budget: TrendingUpIcon,
    purchasing: ShoppingCartIcon,
    quotations: LayersIcon,
    partners: LinkIcon,
    reporting: PieChartIcon,
    'client-portal': EyeIcon,
    ai: SparklesIcon,
    ar: CameraIcon,
    integrations: CloudIcon,
};
