import React, { useState } from "react";
import { Button, Input, Modal, Select } from "../ui";
import { JobTitle } from "../../types";

interface EditProfileData {
    name: string;
    initials: string;
    email: string;
    jobTitle: JobTitle | null;
    companyName: string;
    cvr: string;
    address: string;
    phone: string;
}

interface EditProfileModalProps {
    initialName: string;
    initialInitials: string;
    initialEmail?: string;
    initialJobTitle?: JobTitle | null;
    initialCompanyName?: string | null;
    initialCvr?: string | null;
    initialAddress?: string | null;
    initialPhone?: string | null;
    onClose: () => void;
    onSave: (data: EditProfileData) => void;
}

const JOB_TITLES: { value: JobTitle; label: string }[] = [
    { value: "CEO", label: "CEO" },
    { value: "Manager", label: "Manager" },
    { value: "Staff", label: "Medarbejder (Staff)" },
    { value: "No title", label: "Ingen titel" },
];

/** Group heading inside the profile form. */
const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
        {children}
    </p>
);

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
    initialName, initialInitials, initialEmail = "",
    initialJobTitle, initialCompanyName, initialCvr, initialAddress, initialPhone,
    onClose, onSave,
}) => {
    const [name, setName] = useState(initialName);
    const [initials, setInitials] = useState(initialInitials);
    const [email, setEmail] = useState(initialEmail);
    const [jobTitle, setJobTitle] = useState<JobTitle | "">(initialJobTitle ?? "");
    const [companyName, setCompanyName] = useState(initialCompanyName ?? "");
    const [cvr, setCvr] = useState(initialCvr ?? "");
    const [address, setAddress] = useState(initialAddress ?? "");
    const [phone, setPhone] = useState(initialPhone ?? "");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!name.trim()) e.name = "Navn er påkrævet";
        if (!email.trim()) e.email = "E-mail er påkrævet";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Ugyldig e-mailadresse";
        return e;
    };

    const handleSave = () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        onSave({
            name: name.trim(),
            initials: initials.trim().toUpperCase().slice(0, 3),
            email: email.trim(),
            jobTitle: jobTitle || null,
            companyName: companyName.trim(),
            cvr: cvr.trim(),
            address: address.trim(),
            phone: phone.trim(),
        });
        onClose();
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Rediger Profil"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button onClick={handleSave}>Gem</Button>
                </>
            }
        >
            <div className="space-y-5">
                <div>
                    <GroupLabel>Personlig information</GroupLabel>
                    <div className="space-y-3">
                        <Input
                            label="Navn"
                            required
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                            placeholder="Fulde navn"
                            error={errors.name || undefined}
                        />
                        <Input
                            label="Initialer (max 3 tegn)"
                            value={initials}
                            onChange={e => setInitials(e.target.value)}
                            maxLength={3}
                            className="uppercase"
                            placeholder="F.eks. MH"
                        />
                        <Input
                            label="E-mail"
                            required
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
                            placeholder="din@email.dk"
                            error={errors.email || undefined}
                        />
                        <Input
                            label="Telefon"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+45 12 34 56 78"
                        />
                        <Select
                            label="Titel / Rolle"
                            value={jobTitle}
                            onChange={e => setJobTitle(e.target.value as JobTitle | "")}
                        >
                            <option value="">Vælg titel...</option>
                            {JOB_TITLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                    </div>
                </div>
                <div>
                    <GroupLabel>Virksomhedsoplysninger</GroupLabel>
                    <div className="space-y-3">
                        <Input
                            label="Virksomhedsnavn"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="F.eks. Hansen Byg A/S"
                        />
                        <Input
                            label="CVR-nummer"
                            value={cvr}
                            onChange={e => setCvr(e.target.value)}
                            placeholder="F.eks. 12345678"
                            maxLength={8}
                        />
                        <Input
                            label="Adresse"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Gadenavn nr., By"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
