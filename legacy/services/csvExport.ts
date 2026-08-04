// Generalized from the CSV export in pages/TimeManagementTabContent.tsx —
// same semicolon-delimited, UTF-8 format Excel (da-DK locale) expects.

const escapeCell = (value: unknown): string => {
    const s = value == null ? '' : String(value);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Triggers a browser download of `rows` as a semicolon-delimited CSV file. */
export const downloadCsv = (filename: string, headers: string[], rows: Array<Array<unknown>>): void => {
    const content = [headers, ...rows]
        .map((row) => row.map(escapeCell).join(';'))
        .join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
