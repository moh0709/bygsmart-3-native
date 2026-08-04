import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    SearchIcon,
    FolderIcon,
    CheckIcon,
    QuestionCircleIcon,
    SlidersHorizontalIcon,
    ChecklistIcon,
    ThumbsUpIcon,
    CheckSquareIcon
} from '../components/icons';

const Step1Content = () => (
    <>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Find Svaret Straks</h1>
        <p className="text-text-secondary mb-12">Søg i alle danske bygningsreglementer og brandkoder fra ét sted, og spar tid på byggepladsen.</p>
        <div className="w-full space-y-6">
            <div className="relative bg-white rounded-full shadow-md p-2 flex items-center">
                <SearchIcon className="w-6 h-6 text-gray-400 mx-4" />
                <span className="text-gray-800">brandkrav for etagebyggeri</span>
                <span className="w-0.5 h-6 bg-brand-primary animate-ping absolute" style={{left: '17rem'}}></span>
            </div>
            <div className="bg-white rounded-card shadow-xl p-6 text-left w-full max-w-sm mx-auto">
                <h2 className="font-bold text-lg text-text-primary">BR18 §104 - Adgangsforhold</h2>
                <p className="text-text-secondary mt-2 text-sm">Bestemmelser om adgangsforhold for redningsberedskabet, herunder krav til redningsåbninger...</p>
            </div>
        </div>
    </>
);

const Step2Content = () => {
    const features = [
        { icon: CheckSquareIcon, title: 'Skræddersyede tjeklister', text: 'Trin-for-trin vejledning tilpasset din specifikke opgave.' },
        { icon: SlidersHorizontalIcon, title: 'Altid med henvisning', text: 'Hvert punkt er direkte koblet til det gældende bygningsreglement.' },
        { icon: FolderIcon, title: 'Fokuser på opgaven', text: 'Brug mere tid på arbejdet og mindre tid på at søge efter regler.' }
    ];
    return (
        <>
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Få den rigtige tjekliste, hver gang.</h1>
            <p className="text-text-secondary mb-12">Vores 'Jeg skal bygge...' guide bygger en personlig tjekliste til din opgave, baseret på gældende regler.</p>
            <div className="w-full space-y-8">
                <div className="relative text-left w-full max-w-sm mx-auto">
                    <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-gray-200 border-l-2 border-dashed border-gray-300"></div>
                    <div className="flex items-center space-x-4 relative z-10">
                        <div className="w-12 h-12 bg-blue-100/70 rounded-full flex items-center justify-center flex-shrink-0"><QuestionCircleIcon className="w-6 h-6 text-brand-primary" /></div>
                        <div>
                            <h3 className="font-semibold">Jeg skal bygge...</h3>
                            <p className="text-sm text-text-secondary">Vælg din opgave</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 relative z-10 mt-8">
                        <div className="w-12 h-12 bg-blue-100/70 rounded-full flex items-center justify-center flex-shrink-0"><SlidersHorizontalIcon className="w-6 h-6 text-brand-primary" /></div>
                        <div>
                            <h3 className="font-semibold">Præcisér detaljer</h3>
                            <p className="text-sm text-text-secondary">Svar på spørgsmål</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 relative z-10 mt-8">
                        <div className="w-12 h-12 bg-blue-100/70 rounded-full flex items-center justify-center flex-shrink-0"><ChecklistIcon className="w-6 h-6 text-brand-primary" /></div>
                        <div>
                            <h3 className="font-semibold">Din personlige tjekliste</h3>
                            <p className="text-sm text-text-secondary">§ BR18</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const Step3Content = () => (
    <>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Saml alt på ét sted</h1>
        <p className="text-text-secondary mb-12">Hold styr på bygningsreglement, opgaver og kommunikation for hvert enkelt projekt. Fra start til slut.</p>
        <div className="bg-white rounded-modal shadow-xl p-6 w-full max-w-sm mx-auto space-y-4 text-left">
            <div className="flex items-start space-x-3">
                <div className="bg-gray-100 p-3 rounded-lg"><FolderIcon className="w-6 h-6 text-text-secondary"/></div>
                <div>
                    <h2 className="font-bold text-lg text-text-primary">Renovering Valby</h2>
                    <p className="text-sm text-text-secondary">Gladsaxevej 123</p>
                </div>
            </div>
            <div className="space-y-3">
                <div>
                    <label className="text-sm font-semibold text-text-secondary">Regler</label>
                    <div className="mt-1 bg-bg-subtle p-3 rounded-lg text-text-primary">BR18, §112 - Brandforhold</div>
                </div>
                <div>
                    <label className="text-sm font-semibold text-text-secondary">Opgaver</label>
                    <div className="mt-1 bg-bg-subtle p-3 rounded-lg text-text-primary flex items-center space-x-2">
                        <div className="w-5 h-5 bg-brand-primary rounded-md flex items-center justify-center"><CheckIcon className="w-4 h-4 text-white"/></div>
                        <span>Montering af branddøre</span>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-semibold text-text-secondary">Beskeder</label>
                    <div className="mt-1 bg-bg-subtle p-3 rounded-lg text-text-primary flex justify-between items-center">
                        <span>1 ny besked</span>
                        <button className="bg-brand-primary text-white text-sm font-semibold px-4 py-1.5 rounded-lg">Vis</button>
                    </div>
                </div>
            </div>
        </div>
    </>
);

const Step4Content: React.FC<{ onFinish: () => void }> = ({ onFinish }) => (
    <>
        <div className="relative w-40 h-40">
            <div className="absolute inset-0 bg-blue-100/70 rounded-full animate-pulse-slow"></div>
            <div className="absolute inset-2 bg-blue-100 rounded-full flex items-center justify-center">
                <ThumbsUpIcon className="w-20 h-20 text-brand-primary" />
            </div>
            <div className="absolute top-2 right-2 bg-yellow-400 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                <CheckIcon className="w-6 h-6 text-white" />
            </div>
        </div>
        <h1 className="text-4xl font-bold text-text-primary mt-8 mb-4">Du er klar!</h1>
        <p className="text-text-secondary mb-8">Introduktionen er nu færdig. Du kan nu logge ind for at begynde at bruge appen.</p>
        <div className="w-full space-y-3">
            <button onClick={onFinish} className="w-full bg-brand-primary text-white font-semibold py-4 rounded-xl shadow-lg hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Gå til Login</button>
        </div>
    </>
);

const OnboardingPage: React.FC = () => {
    const [step, setStep] = useState(0);
    const [animationClass, setAnimationClass] = useState('animate-fade-in');
    const navigate = useNavigate();

    const totalSteps = 4;

    const handleNext = () => {
        if (step < totalSteps - 1) {
            setAnimationClass('animate-fade-out');
            setTimeout(() => {
                setStep(s => s + 1);
                setAnimationClass('animate-fade-in');
            }, 300);
        }
    };
    
    const handleSkip = () => navigate('/login', { replace: true });
    const handleFinish = () => navigate('/login', { replace: true });

    const renderStepContent = () => {
        switch (step) {
            case 0: return <Step1Content />;
            case 1: return <Step2Content />;
            case 2: return <Step3Content />;
            case 3: return <Step4Content onFinish={handleFinish} />;
            default: return null;
        }
    };

    const getButtonClass = () => {
        const base = 'w-full font-semibold py-4 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
        if (step === 0) return `${base} bg-[#00529B] text-white hover:bg-opacity-90 focus:ring-blue-700`;
        return `${base} bg-brand-primary text-white hover:bg-blue-600 focus:ring-blue-500`;
    }

    return (
        <div className="bg-white min-h-screen flex flex-col items-center justify-between p-8 text-center font-sans overflow-hidden">
            <div className={`flex-grow flex flex-col items-center justify-center w-full max-w-md ${animationClass}`}>
                {renderStepContent()}
            </div>
            
            {step < totalSteps - 1 && (
                <div className="flex-shrink-0 w-full max-w-sm mt-8">
                    <div className="flex justify-center space-x-3 my-8">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === step ? 'bg-brand-primary' : 'bg-gray-300'}`}></div>
                        ))}
                    </div>
                    <button onClick={handleNext} className={getButtonClass()}>
                        {step === 2 ? 'Fortsæt' : 'Næste'}
                    </button>
                    <button onClick={handleSkip} className="mt-3 w-full text-text-secondary font-semibold py-2">
                        Udforsk BYG SMART
                    </button>
                </div>
            )}
        </div>
    );
};

export default OnboardingPage;