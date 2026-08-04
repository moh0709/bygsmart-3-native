import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';

// Custom logo icon to match the design
const ByggeAppLogoIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


const WelcomePage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoaded, setIsLoaded] = useState(false);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        // Trigger animations shortly after the component mounts
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleStart = () => {
        if (isAuthenticated) {
            navigate('/home');
        } else {
            navigate('/login');
        }
    };

    const handleStartTour = () => {
        navigate('/onboarding');
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-white">
            {/* Animated Background Image */}
            <div
                className={`absolute top-0 left-0 w-full h-full bg-cover bg-center transition-transform duration-1000 ease-in-out ${isLoaded ? 'translate-y-0' : '-translate-y-1/4'}`}
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=2070&auto=format&fit=crop')" }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-end h-full p-8 pb-12">
                <div className="w-full max-w-md">
                    {/* Logo and Text Block */}
                    <div className={`text-center space-y-6 transition-opacity duration-1000 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="flex items-center justify-center space-x-4">
                            <div className="bg-[#00529B] p-3 rounded-xl shadow-md">
                                <ByggeAppLogoIcon />
                            </div>
                            <span className="text-4xl font-extrabold text-[#1D2939] tracking-wide">BYG SMART</span>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
                                Gør dit byggeprojekt til virkelighed
                            </h1>
                            <p className="text-base text-text-secondary max-w-sm mx-auto">
                                Alt hvad du behøver for at planlægge, bygge og renovere – lige ved hånden.
                            </p>
                        </div>
                    </div>

                    {/* Animated Buttons */}
                    <div className={`w-full mt-12 space-y-3 transition-all duration-1000 ease-in-out delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}>
                        <button
                            onClick={handleStart}
                            className="w-full bg-[#00529B] text-white font-semibold py-4 rounded-xl shadow-lg hover:bg-opacity-90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {isAuthenticated ? 'Fortsæt til Hjem' : 'Log ind / Start Dit Projekt'}
                        </button>
                        <button
                            onClick={handleStartTour}
                            className="w-full bg-[#F2F4F7] text-[#344054] font-semibold py-4 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                        >
                            Udforsk BYG SMART
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomePage;