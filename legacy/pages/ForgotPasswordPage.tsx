import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { Alert, Button, Card, Input } from '../components/ui';

const ByggeAppLogoIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setIsLoading(true);
        try {
            const result = await resetPassword(email);
            setIsError(!result.success);
            setMessage(result.message);
            if (result.success) setSent(true);
        } catch {
            setIsError(true);
            setMessage('Der opstod en fejl. Prøv igen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex flex-col justify-center items-center px-4 py-8 pt-safe pb-safe">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="bg-brand-primary text-white p-3 rounded-card shadow-card">
                        <ByggeAppLogoIcon />
                    </div>
                    <span className="text-title text-text-primary dark:text-text-dark-primary tracking-wide">BYG SMART</span>
                </div>

                <Card padding="lg">
                    <h1 className="text-title text-center text-text-primary dark:text-text-dark-primary mb-1">Glemt adgangskode?</h1>
                    <p className="text-body text-center text-text-secondary dark:text-text-dark-secondary mb-6">
                        Indtast din e-mail, så sender vi et nulstillingslink.
                    </p>

                    {sent ? (
                        <div className="space-y-4">
                            <Alert variant="success" title={message}>
                                Tjek din indbakke (og evt. spam-mappe).
                            </Alert>
                            <div className="text-center">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center min-h-11 px-2 text-label font-semibold text-brand-primary hover:underline"
                                >
                                    ← Tilbage til login
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="email"
                                label="E-mail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="din@email.dk"
                            />
                            {message && (
                                <Alert variant={isError ? 'danger' : 'success'}>{message}</Alert>
                            )}
                            <Button type="submit" size="lg" fullWidth loading={isLoading}>
                                {isLoading ? 'Sender...' : 'Send nulstillingslink'}
                            </Button>
                            <div className="text-center">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center min-h-11 px-2 text-label text-text-secondary dark:text-text-dark-secondary hover:underline"
                                >
                                    ← Tilbage til login
                                </Link>
                            </div>
                        </form>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
