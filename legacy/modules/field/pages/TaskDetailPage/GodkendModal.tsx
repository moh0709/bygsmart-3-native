import React, { useState } from 'react';
import type { Task, TaskQualityControl } from '../../../../types';
import { XIcon } from '../../../../components/icons';
import { useToast } from '../../../../contexts/ToastContext';
import { resolveStoragePathToDataUrl } from '../../../../utils/fileUtils';
import {
    Alert,
    Button,
    Input,
    Modal,
    Spinner,
    cn,
} from '../../../../components/ui';
import {
    getReportSettings,
    listTaskDocumentation,
    uploadSignature,
    uploadTaskFile,
    acceptTaskHandover,
} from '../../services/taskWorkspace';
import { generateTaskAcceptanceReport } from '../../../reporting';
import type { TaskTimeEntry } from '../../../reporting';
import { listTaskQualityControls } from '../../../quality';
import { supabase } from '../../../../services/supabaseClient';
import type { AcceptedPartnerInfo } from '../../../partners';
import SignatureCanvas from '../../../../components/SignatureCanvas';
import { useModuleGate } from '../../../../core/entitlements/ModuleGate';
import { ICON_BTN } from './constants';

// ─── GodkendModal ─────────────────────────────────────────────────────────────

export const GodkendModal: React.FC<{
    taskId: string;
    projectId: string;
    task: Task;
    mesterName: string;
    acceptedPartner: AcceptedPartnerInfo | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ taskId, projectId, task, mesterName, acceptedPartner, onClose, onSuccess }) => {
    const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
    const [snagInput, setSnagInput] = useState('');
    const [snagDeadline, setSnagDeadline] = useState('');
    const [snags, setSnags] = useState<{ description: string; deadline?: string }[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();
    // `reporting` gates the acceptance-report PDF (generation + upload) that this
    // modal's primary action produces as a side effect; approval itself must not
    // depend on it. `quality` gates whether the QC section is pulled into that PDF.
    const reportingEnabled = useModuleGate('reporting');
    const qualityEnabled = useModuleGate('quality');

    const addSnag = () => {
        const desc = snagInput.trim();
        if (!desc) return;
        setSnags(prev => [...prev, { description: desc, deadline: snagDeadline || undefined }]);
        setSnagInput('');
        setSnagDeadline('');
    };

    const removeSnag = (i: number) => setSnags(prev => prev.filter((_, idx) => idx !== i));

    const handleApprove = async () => {
        setSubmitting(true);
        try {
            const now = new Date().toISOString();

            // Upload Mester signature
            let mesterSigPath: string | undefined;
            if (sigDataUrl) {
                mesterSigPath = await uploadSignature(sigDataUrl);
            }

            // Acceptance-report PDF (generation + upload) requires the `reporting`
            // module — skip this whole sub-flow when it's not entitled and approve
            // without a report; acceptTaskHandover tolerates reportPath being unset.
            let reportPath: string | undefined;
            if (reportingEnabled) {
                // Fetch supplier signature as dataURL (for embedding in PDF)
                let supplierSigDataUrl: string | undefined;
                let supplierName = '';
                const { data: handoverRow } = await (supabase as any)
                    .from('task_handovers')
                    .select('supplier_signature_path, submitted_by, submitted_at')
                    .eq('task_id', taskId)
                    .eq('status', 'submitted')
                    .single();

                supplierSigDataUrl = await resolveStoragePathToDataUrl(
                    handoverRow?.supplier_signature_path as string | undefined
                );
                if (handoverRow?.submitted_by) {
                    const { data: profile } = await (supabase as any)
                        .from('profiles')
                        .select('name')
                        .eq('id', handoverRow.submitted_by)
                        .single();
                    supplierName = profile?.name ?? '';
                }

                // Load time entries for this task
                const { data: teRows } = await (supabase as any)
                    .from('time_entries')
                    .select('date, hours, description, user_name')
                    .eq('task_id', taskId)
                    .order('date', { ascending: true });
                const timeEntries: TaskTimeEntry[] = (teRows ?? []).map((r: any) => ({
                    date: r.date ?? '',
                    hours: r.hours ?? 0,
                    description: r.description ?? undefined,
                    userName: r.user_name ?? '',
                }));

                // Load documentation
                const docs = await listTaskDocumentation(taskId);
                const docsWithImages = await Promise.all(
                    docs.map(async d => {
                        const resolvedImageDataUrl = d.kind === 'photo' && d.storagePath
                            ? await resolveStoragePathToDataUrl(d.storagePath)
                            : undefined;
                        return { ...d, resolvedImageDataUrl };
                    })
                );

                // Load report settings first — the KS section can be disabled for
                // this project, in which case skip the quality-control query and
                // photo resolution entirely so an optional table/storage error
                // can never block approval.
                const settings = await getReportSettings(projectId);

                // Load quality control checks + resolve deviation photos to data URLs
                // — gated on both the project's report setting and the `quality`
                // module entitlement (a project could enable the setting before
                // losing the module, or vice versa).
                let qualityControls: (TaskQualityControl & { deviationPhotoDataUrls: string[] })[] = [];
                if (settings.showQualityControl && qualityEnabled) {
                    const qcs = await listTaskQualityControls(taskId);
                    qualityControls = await Promise.all(
                        qcs.map(async qc => {
                            const resolvedPhotos = await Promise.all(
                                (qc.deviationPhotos ?? []).map(photo => resolveStoragePathToDataUrl(photo.storagePath))
                            );
                            const deviationPhotoDataUrls = resolvedPhotos.filter((url): url is string => !!url);
                            return { ...qc, deviationPhotoDataUrls };
                        })
                    );
                }

                // Use task-scoped partner (already loaded by parent page — avoids
                // picking the wrong supplier when different tasks have different partners)
                let partnerName = supplierName || 'Underentreprenør';
                let agreedPriceOre: number | undefined;
                if (acceptedPartner) {
                    partnerName = acceptedPartner.partnerName;
                    if (acceptedPartner.agreedPriceOre != null) {
                        agreedPriceOre = acceptedPartner.agreedPriceOre;
                    }
                }

                // Load project number
                const { data: proj } = await (supabase as any)
                    .from('projects')
                    .select('project_number, name')
                    .eq('id', projectId)
                    .single();

                // Load Mester company branding (name, CVR, logo)
                const { data: { user: authUser } } = await supabase.auth.getUser();
                let companyName: string | undefined;
                let cvr: string | undefined;
                let logoDataUrl: string | undefined;
                if (authUser) {
                    try {
                        // Branding comes from the profile itself -- the companies
                        // table was retired in Phase 7 W7e (orgs replaced it).
                        const { data: mesterProfile } = await (supabase as any)
                            .from('profiles')
                            .select('company_name, cvr')
                            .eq('id', authUser.id)
                            .single();
                        if (mesterProfile?.company_name) companyName = mesterProfile.company_name;
                        if (mesterProfile?.cvr) cvr = mesterProfile.cvr;
                    } catch { /* skip branding if profile fetch fails */ }
                }

                // Mester sig dataURL
                let mesterSigDataUrl: string | undefined;
                if (mesterSigPath) {
                    mesterSigDataUrl = (await resolveStoragePathToDataUrl(mesterSigPath)) ?? sigDataUrl ?? undefined;
                } else if (sigDataUrl) {
                    mesterSigDataUrl = sigDataUrl;
                }

                // Generate PDF
                const reportId = `RPT-${Date.now()}`;
                const pdfDoc = generateTaskAcceptanceReport({
                    reportId,
                    generatedAt: now,
                    task,
                    projectNumber: proj?.project_number ?? undefined,
                    projectName: proj?.name ?? undefined,
                    companyName,
                    cvr,
                    logoDataUrl,
                    mesterName,
                    partnerName,
                    agreedPriceOre,
                    timeEntries,
                    documentation: docsWithImages,
                    qualityControls,
                    snags: snags.length > 0 ? snags : undefined,
                    supplierSignatureDataUrl: supplierSigDataUrl,
                    supplierSignatureName: supplierName || partnerName,
                    supplierSignatureTimestamp: handoverRow?.submitted_at ?? undefined,
                    mesterSignatureDataUrl: mesterSigDataUrl,
                    mesterSignatureName: mesterName,
                    mesterSignatureTimestamp: now,
                    settings,
                });

                // Upload PDF to task-docs
                const pdfArrayBuffer = pdfDoc.output('arraybuffer');
                const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
                reportPath = await uploadTaskFile(projectId, taskId, pdfBlob, 'application/pdf');
            }

            // Accept handover (updates task, pins report, notifies worker)
            await acceptTaskHandover(taskId, projectId, {
                signaturePath: mesterSigPath,
                snags: snags.length > 0 ? (snags as unknown as Record<string, unknown>[]) : undefined,
                reportPath,
            });

            onSuccess();
        } catch (err: any) {
            showToast(err?.message ?? 'Fejl ved godkendelse', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open
            title="Godkend opgave"
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>Annuller</Button>
                    <Button onClick={handleApprove} disabled={!sigDataUrl} loading={submitting}>
                        {reportingEnabled ? 'Godkend & generer rapport' : 'Godkend'}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <Alert variant="info" title="Sidste trin i afleveringen">
                    Din underskrift bekræfter godkendelse.
                    {reportingEnabled && ' En afleveringsrapport genereres og fastgøres i Dokumentation.'}
                </Alert>

                <SignatureCanvas
                    label="Mesterens underskrift (påkrævet)"
                    onSignatureChange={setSigDataUrl}
                />

                {/* Mangelliste input */}
                <div>
                    <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">
                        Mangelliste (valgfri)
                    </p>
                    <div className="mb-2 flex gap-2">
                        <div className="min-w-0 grow">
                            <Input
                                aria-label="Beskriv mangel"
                                value={snagInput}
                                onChange={e => setSnagInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addSnag()}
                                placeholder="Beskriv mangel…"
                            />
                        </div>
                        <div className="w-32 shrink-0">
                            <Input
                                aria-label="Udbedringsfrist"
                                title="Udbedringsfrist"
                                type="date"
                                value={snagDeadline}
                                onChange={e => setSnagDeadline(e.target.value)}
                            />
                        </div>
                        <Button variant="secondary" onClick={addSnag} className="shrink-0">Tilføj</Button>
                    </div>
                    {snags.length > 0 && (
                        <ul className="space-y-1.5">
                            {snags.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex items-center justify-between gap-2 rounded-control border border-warning-border bg-warning-subtle px-3 py-1.5 dark:border-warning/30 dark:bg-warning-subtle-dark"
                                >
                                    <span className="min-w-0 text-label text-warning-strong dark:text-warning">
                                        {s.description}{s.deadline ? ` · frist ${s.deadline}` : ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeSnag(i)}
                                        aria-label={`Fjern mangel: ${s.description}`}
                                        className={cn(ICON_BTN, '-my-2 h-9 w-9')}
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {submitting && (
                    <Alert variant="info" icon={<Spinner className="h-5 w-5" />}>
                        {reportingEnabled ? 'Genererer og uploader afleveringsrapport…' : 'Godkender opgave…'}
                    </Alert>
                )}
            </div>
        </Modal>
    );
};
