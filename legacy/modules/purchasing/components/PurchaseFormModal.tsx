import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { PurchaseItem, Task, Project, Supplier, VendorItem, PurchaseStatus } from '../../../types';
import { getSuppliers, getVendorItemsBySupplier } from '../services/suppliers';
import { processFileForStorage, resolveFileUrl } from '../../../utils/fileUtils';
import { ImageIcon, FileTextIcon, CalculatorIcon } from '../../../components/icons';
import FilePicker from '../../../components/FilePicker';
import type { CalculatorPickerResult } from '../../../modules/tools';
import { Badge, Button, Input, Modal, Select, Textarea } from '../../../components/ui';
import { quickQuantityCheck, QuickCheckResult } from '../../ai';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';

// modules/tools reaches back into purchasing dynamically (calculator "save to
// project"); this was statically importing modules/tools, forming a chunk-graph
// cycle Rollup collapsed into the calculators-pages bundle. Load lazily instead
// (mirrors the same fix in modules/tasks/components/TaskFormModal.tsx).
const CalculatorPickerModal = lazy(() => import('../../../modules/tools').then((m) => ({ default: m.CalculatorPickerModal })));

interface PurchaseFormModalProps {
  item?: PurchaseItem;
  tasks: Task[];
  team: Project['team'];
  onClose: () => void;
  onSave: (payload: Omit<PurchaseItem, 'id'>, id?: string) => void;
  onDelete?: (id: string) => void;
}

// Simple searchable dropdown built on the kit Input, for internal use
const SearchableDropdown: React.FC<{
    label: string;
    options: { id: string; name: string; itemNumber?: string }[];
    value: string;
    onValueChange: (value: string) => void;
    onSelect: (option: { id: string; name: string }) => void;
    placeholder?: string;
    disabled?: boolean;
  }> = ({ label, options, value, onValueChange, onSelect, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
      opt.name.toLowerCase().includes(value.toLowerCase()) ||
      (opt.itemNumber && opt.itemNumber.toLowerCase().includes(value.toLowerCase()))
    );

    return (
      <div className="relative" ref={wrapperRef}>
        <Input
          label={label}
          type="text"
          value={value}
          onChange={e => {
            onValueChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {isOpen && !disabled && filteredOptions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 rounded-control border border-border bg-bg shadow-raised dark:border-border-dark dark:bg-bg-dark-surface max-h-48 overflow-y-auto">
            {filteredOptions.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onSelect(option);
                  onValueChange(option.name);
                  setIsOpen(false);
                }}
                className="w-full min-h-11 px-3 py-2 text-left hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
              >
                <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary">{option.name}</span>
                {option.itemNumber && <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">Varenr: {option.itemNumber}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
};

export const PurchaseFormModal: React.FC<PurchaseFormModalProps> = ({ item, tasks, team, onClose, onSave, onDelete }) => {
    const aiEnabled = useModuleGate('ai');
    const [formData, setFormData] = useState({
    name: item?.name || '',
    details: item?.details || '',
    quantity: item?.quantity?.toString() || '1',
    price: item?.price?.toString() || '',
    status: item?.status || ('Afventer' as PurchaseStatus),
    supplierId: '',
    supplierName: item?.supplier || '',
    itemNumber: item?.itemNumber || '',
    taskId: item?.taskId || '',
    assigneeId: item?.assigneeId || '',
    expectedDeliveryDate: item?.expectedDeliveryDate || ''
  });
  const [attachment, setAttachment] = useState<PurchaseItem['attachment']>(item?.attachment);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dropdown and auto-fill state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vendorItems, setVendorItems] = useState<VendorItem[]>([]);
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(!!item?.price);
  const [selectedVendorItem, setSelectedVendorItem] = useState<VendorItem | null>(null);

  // Calculator integration + non-blocking AI quantity check
  const [showCalcPicker, setShowCalcPicker] = useState(false);
  const [resultUnit, setResultUnit] = useState<string>('');
  const [quantityCheck, setQuantityCheck] = useState<QuickCheckResult | null>(null);
  const [isCheckingQuantity, setIsCheckingQuantity] = useState(false);
  const quantityCheckRequestId = useRef(0);

  const handleCalculatorResult = (res: CalculatorPickerResult) => {
    const inputsText = Object.entries(res.inputs)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    const provenance = `Beregnet med ${res.calculatorName}: ${inputsText} → ${res.result.toLocaleString('da-DK')} ${res.unit}`;
    setResultUnit(res.unit);
    setFormData(f => ({
      ...f,
      quantity: String(res.result),
      details: f.details.trim() ? `${f.details.trimEnd()}\n${provenance}` : provenance,
    }));
  };

  // Debounced, non-blocking plausibility check (never blocks saving).
  // Skipped entirely when the `ai` module isn't entitled — manual purchase
  // entry keeps working without it.
  useEffect(() => {
    if (!aiEnabled) {
      setQuantityCheck(null);
      setIsCheckingQuantity(false);
      return;
    }

    const name = formData.name.trim();
    const qty = parseFloat(formData.quantity);

    if (name.length < 3 || !Number.isFinite(qty)) {
      setQuantityCheck(null);
      setIsCheckingQuantity(false);
      return;
    }

    const requestId = ++quantityCheckRequestId.current;
    setIsCheckingQuantity(true);

    const timer = window.setTimeout(() => {
      quickQuantityCheck(name, qty, resultUnit || selectedVendorItem?.unit, formData.details)
        .then(result => {
          if (quantityCheckRequestId.current === requestId) setQuantityCheck(result);
        })
        .catch(() => {
          if (quantityCheckRequestId.current === requestId) setQuantityCheck(null);
        })
        .finally(() => {
          if (quantityCheckRequestId.current === requestId) setIsCheckingQuantity(false);
        });
    }, 800);

    return () => window.clearTimeout(timer);

  }, [formData.name, formData.quantity, aiEnabled]);

  const total = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const prc = parseFloat(formData.price) || 0;
    return qty * prc;
  }, [formData.quantity, formData.price]);

  useEffect(() => {
    getSuppliers().then(setSuppliers);
  }, []);

  // Load preview if attachment exists
  useEffect(() => {
      if (item?.attachment?.url) {
          resolveFileUrl(item.attachment.url).then(setFilePreview);
      }
  }, [item]);

  useEffect(() => {
    if (item?.supplier) {
        const foundSupplier = suppliers.find(s => s.name === item.supplier);
        if (foundSupplier) {
            setFormData(f => ({ ...f, supplierId: foundSupplier.id, supplierName: foundSupplier.name }));
            getVendorItemsBySupplier(foundSupplier.id).then(setVendorItems);
        }
    }
  }, [item, suppliers]);

  const handleSupplierSelect = (supplier: { id: string, name: string }) => {
    setFormData(f => ({ ...f, supplierId: supplier.id, supplierName: supplier.name, itemNumber: '', name: '' }));
    setVendorItems([]);
    setSelectedVendorItem(null);
    setIsPriceManuallySet(false);
    getVendorItemsBySupplier(supplier.id).then(setVendorItems);
  };

  const handleVendorItemSelect = (vendorItem: VendorItem) => {
    setSelectedVendorItem(vendorItem);
    setIsPriceManuallySet(false);
    setFormData(f => ({
        ...f,
        name: vendorItem.name,
        itemNumber: vendorItem.itemNumber,
        price: vendorItem.price.toString()
    }));
  };

  const handleFileSelect = async (file: File) => {
    // Use processFileForStorage to save to IDB immediately, avoiding large base64 strings in state/DB
    const processed = await processFileForStorage(file);
    // Resolve the new IDB url for preview
    const previewUrl = await resolveFileUrl(processed.dataUrl);

    setFilePreview(previewUrl);
    setAttachment({
        url: processed.dataUrl,
        type: processed.type.startsWith('image/') ? 'image' : 'pdf',
        name: processed.name
    });
  };

  const handleSave = async () => {
    const payload: Omit<PurchaseItem, 'id'> = {
      name: formData.name,
      details: formData.details,
      quantity: parseFloat(formData.quantity) || 0,
      price: parseFloat(formData.price) || 0,
      status: formData.status,
      supplier: formData.supplierName,
      itemNumber: formData.itemNumber,
      attachment: attachment || undefined,
      taskId: formData.taskId || undefined,
      assigneeId: formData.assigneeId || undefined,
      expectedDeliveryDate: formData.expectedDeliveryDate || undefined
    };
    setSaving(true);
    try {
      await onSave(payload, item?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={item ? "Rediger indkøb" : "Nyt indkøb"}
      onClose={onClose}
      data-ref-id="purchase-form-modal"
      footer={
        <>
          {item && onDelete && (
            <Button
              variant="ghost"
              className="mr-auto text-danger-strong hover:bg-danger-subtle hover:text-danger-strong dark:text-danger dark:hover:bg-danger-subtle-dark dark:hover:text-danger"
              onClick={() => onDelete(item.id)}
            >
              Slet
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Annuller</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!formData.name.trim() || !formData.price || !formData.quantity}
          >
            {item ? 'Gem ændringer' : 'Opret'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SearchableDropdown
            label="Leverandør"
            options={suppliers.map(s => ({id: s.id, name: s.name}))}
            value={formData.supplierName}
            onValueChange={val => setFormData(f => ({...f, supplierName: val, supplierId: ''}))}
            onSelect={handleSupplierSelect}
            placeholder="Søg eller vælg..."
        />
        <SearchableDropdown
            label="Vare"
            options={vendorItems.map(i => ({id: i.id, name: i.name, itemNumber: i.itemNumber}))}
            value={formData.name}
            onValueChange={val => setFormData(f => ({...f, name: val}))}
            onSelect={opt => {
                const fullItem = vendorItems.find(i => i.id === opt.id);
                if (fullItem) handleVendorItemSelect(fullItem);
            }}
            placeholder={formData.supplierId ? "Søg vare..." : "Vælg leverandør først"}
            disabled={!formData.supplierId}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Navn" value={formData.name} onChange={(e) => setFormData(f => ({...f, name: e.target.value}))} />
        <Input label="Varenummer" value={formData.itemNumber} onChange={(e) => setFormData(f => ({...f, itemNumber: e.target.value}))} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Antal" type="number" value={formData.quantity} onChange={(e) => setFormData(f => ({...f, quantity: e.target.value}))} min="0" />
        <Input label="Pris (kr.)" type="number" value={formData.price} onChange={(e) => {setFormData(f => ({...f, price: e.target.value})); setIsPriceManuallySet(true); }} min="0" />
        <Input label="Total (kr.)" readOnly value={total.toFixed(2)} className="bg-bg-muted dark:bg-bg-dark-muted tabular-nums" />
      </div>

      {/* Calculator + non-blocking AI plausibility check */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          iconLeft={<CalculatorIcon className="w-4 h-4" />}
          onClick={() => setShowCalcPicker(true)}
        >
          Beregn
        </Button>
        <div className="min-w-0 text-right" aria-live="polite">
          {isCheckingQuantity ? (
            <Badge variant="neutral" dot>AI-tjek af mængde…</Badge>
          ) : quantityCheck ? (
            quantityCheck.status === 'ok' ? (
              <Badge variant="success" dot>Mængde ser fornuftig ud</Badge>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <Badge variant="warning" dot>Tjek mængden</Badge>
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary max-w-[260px]">
                  {quantityCheck.message}
                  {quantityCheck.suggestedRange ? ` ${quantityCheck.suggestedRange}` : ''}
                </p>
              </div>
            )
          ) : null}
        </div>
      </div>

       <Textarea label="Detaljer" rows={2} value={formData.details} onChange={(e) => setFormData(f => ({...f, details: e.target.value}))} />

       {/* Enhanced Fields: Logistics & Assignment */}
       <div className="rounded-card border border-border bg-bg-subtle p-3 dark:border-border-dark dark:bg-bg-dark-muted/40">
          <h4 className="text-label font-semibold mb-3 text-text-primary dark:text-text-dark-primary">Logistik &amp; Ansvar</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
             <Input label="Forventet levering" type="date" value={formData.expectedDeliveryDate} onChange={e => setFormData(f => ({...f, expectedDeliveryDate: e.target.value}))} />
             <Select label="Status" value={formData.status} onChange={(e) => setFormData(f => ({...f, status: e.target.value as PurchaseStatus}))}>
                <option>Afventer</option>
                <option>Bestilt</option>
                <option>Modtaget</option>
             </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
              <Select label="Opgave-link" value={formData.taskId} onChange={e => setFormData(f => ({...f, taskId: e.target.value}))}>
                  <option value="">Ingen valgt</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
              <Select label="Ansvarlig" value={formData.assigneeId} onChange={e => setFormData(f => ({...f, assigneeId: e.target.value}))}>
                  <option value="">Vælg person</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
          </div>
       </div>

       <div>
        <span className="block text-label font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Vedhæft fil (billede/PDF)</span>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-control bg-bg-muted dark:bg-bg-dark-muted flex items-center justify-center border border-border dark:border-border-dark overflow-hidden">
              {filePreview ? (
                attachment?.type === 'image'
                  ? <img src={filePreview} className="w-full h-full object-cover rounded-control" alt="Forhåndsvisning"/>
                  : <FileTextIcon className="w-10 h-10 text-text-tertiary dark:text-text-dark-tertiary" />
              ) : <ImageIcon className="w-10 h-10 text-text-tertiary dark:text-text-dark-tertiary"/>}
          </div>
          <div className="flex-1">
            <FilePicker
                onFileSelect={handleFileSelect}
                accept="image/*,application/pdf"
                label="Vælg fil"
                buttonStyle="secondary"
            />
            {attachment && <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2 truncate">Fil: {attachment.name}</p>}
          </div>
        </div>
      </div>
      </div>
      <Suspense fallback={null}>
        <CalculatorPickerModal
          open={showCalcPicker}
          onClose={() => setShowCalcPicker(false)}
          onResult={handleCalculatorResult}
        />
      </Suspense>
    </Modal>
  );
};
