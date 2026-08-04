import React, { useState } from 'react';
import { DownloadIcon, FolderIcon } from '../../../components/icons';
import type { Project } from '../../../types';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';
import { Button, Modal, Select } from '../../../components/ui';
import {
  generateCalculatorReport,
  generateFallbackLandscapePdf,
  type CalculatorReportData,
} from '../services/calculatorPdf';

interface CalculatorActionsProps {
  targetRef: React.RefObject<HTMLDivElement>;
  title: string;
  reportData?: CalculatorReportData;
}

export const CalculatorActions: React.FC<CalculatorActionsProps> = ({ targetRef, title, reportData }) => {
  const documentsEnabled = useModuleGate('documents');
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const safeFilename = (ext: string) =>
    `${title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('da-DK').replace(/\./g, '-')}.${ext}`;

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      if (reportData) {
        const doc = await generateCalculatorReport(reportData);
        doc.save(safeFilename('pdf'));
      } else {
        // Fallback: A4 landscape screenshot, multi-page fit-to-width
        await generateFallbackLandscapePdf(
          targetRef as React.RefObject<HTMLElement | null>,
          safeFilename('pdf')
        );
      }
    } catch (error) {
      console.error('Export failed', error);
      showToast('Kunne ikke generere PDF. Prøv igen.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenSaveModal = async () => {
    if (!documentsEnabled) return;
    setShowSaveModal(true);
    // Eager-chunk rule: projects barrel only via dynamic import here.
    const { getProjects } = await import('../../projects');
    const projs = await getProjects();
    setProjects(projs);
    if (projs.length > 0) setSelectedProjectId(projs[0].id);
  };

  const handleSaveToProject = async () => {
    if (!documentsEnabled || !selectedProjectId) return;
    setIsSaving(true);
    try {
      // Eager-chunk rule: documents barrel only via dynamic import here — it
      // also re-exports DocumentsTabContent, and a static import formed a
      // cycle Rollup collapsed into the calculators-pages bundle in prod.
      const { uploadDocument } = await import('../../documents');
      if (reportData) {
        // Save as branded vector PDF
        const doc = await generateCalculatorReport(reportData);
        const pdfBlob = doc.output('blob');
        const base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(pdfBlob);
        });
        await uploadDocument(selectedProjectId, {
          name: safeFilename('pdf'),
          storagePath: base64data,
          sizeBytes: pdfBlob.size,
          mimeType: 'application/pdf',
          category: 'PLANNING_EXECUTION',
          accessLevel: 'public_team',
          passwordProtected: false,
          isDrawing: false,
          createdBy: user?.name || 'System',
        });
      } else {
        // Fallback: PNG screenshot
        if (!targetRef.current) return;
        const { default: html2canvas } = await import('html2canvas-pro');
        const canvas = await html2canvas(targetRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
        });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
          showToast('Kunne ikke generere billede af beregningen.', 'error');
          return;
        }
        const base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        await uploadDocument(selectedProjectId, {
          name: `${title} - Beregning.png`,
          storagePath: base64data,
          sizeBytes: blob.size,
          mimeType: 'image/png',
          category: 'PLANNING_EXECUTION',
          accessLevel: 'public_team',
          passwordProtected: false,
          isDrawing: false,
          createdBy: user?.name || 'System',
        });
      }
      setShowSaveModal(false);
      showToast('Beregning gemt til projektet.', 'success');
    } catch (error) {
      console.error('Save failed', error);
      showToast('Kunne ikke gemme til projektet. Prøv igen.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-8 pt-4 border-t border-border dark:border-border-dark">
      <div className={documentsEnabled ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
        <Button
          variant="outline"
          onClick={handleExportPdf}
          loading={isExporting}
          iconLeft={<DownloadIcon className="w-5 h-5" />}
          aria-label="Eksporter beregning som PDF"
        >
          Eksporter PDF
        </Button>
        {/* "Gem til projekt" writes a document via the `documents` module — hidden
            when it isn't entitled. The calculator's own PDF export above still works. */}
        {documentsEnabled && (
          <Button
            variant="primary"
            onClick={handleOpenSaveModal}
            iconLeft={<FolderIcon className="w-5 h-5" />}
            aria-label="Gem beregning til projekt"
          >
            Gem til projekt
          </Button>
        )}
      </div>

      {documentsEnabled && (
        <Modal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          title="Gem til projekt"
          description="Beregningen gemmes som dokument på projektet."
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
                Annuller
              </Button>
              <Button
                onClick={handleSaveToProject}
                loading={isSaving}
                disabled={!selectedProjectId}
                iconLeft={<FolderIcon className="w-4 h-4" />}
              >
                Gem beregning
              </Button>
            </>
          }
        >
          <Select
            label="Projekt"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.length === 0 && <option value="">Ingen projekter fundet</option>}
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Modal>
      )}
    </div>
  );
};
