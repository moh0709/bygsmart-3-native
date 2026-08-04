import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { MapPinIcon, FolderIcon } from '../icons';

export const WeatherWidget: React.FC<{ projects: Project[] }> = ({ projects }) => {
    const [weather, setWeather] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    // Filter projects that have an address, or fallback to Copenhagen if none
    const activeProjectsWithLocation = projects.filter(p => p.status === 'I gang');
    
    useEffect(() => {
        const fetchWeather = async () => {
            setLoading(true);
            try {
                let city = 'København';
                let projectName = 'Generelt';
                
                if (activeProjectsWithLocation.length > 0) {
                    const project = activeProjectsWithLocation[currentIndex % activeProjectsWithLocation.length];
                    projectName = project.name;
                    if (project.address) {
                        // Try to extract City from "Zip City" pattern (e.g. "2900 Hellerup")
                        const match = project.address.match(/\d{4}\s+([a-zA-ZæøåÆØÅ\s]+)$/);
                        if (match && match[1]) {
                            city = match[1].trim();
                        }
                    }
                }

                // Geocoding
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
                const geoData = await geoRes.json();
                
                let lat = 55.6761;
                let long = 12.5683;
                
                if (geoData.results?.[0]) {
                    lat = geoData.results[0].latitude;
                    long = geoData.results[0].longitude;
                }

                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=Europe%2FBerlin`);
                const data = await res.json();
                setWeather({ ...data, locationName: city, projectName: projectName });
                setError(false);
            } catch (e) {
                console.error("Weather fetch failed", e);
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, [currentIndex, activeProjectsWithLocation.length]); 

    useEffect(() => {
        if (activeProjectsWithLocation.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % activeProjectsWithLocation.length);
        }, 12000); // 12 seconds
        return () => clearInterval(interval);
    }, [activeProjectsWithLocation.length]);

    if (loading && !weather) return <div className="h-24 bg-bg-muted dark:bg-bg-dark-surface rounded-card animate-pulse"></div>;
    if (error || !weather) return null;

    const current = weather.current;
    const wmoCode = current.weather_code;
    const temp = Math.round(current.temperature_2m);
    const wind = current.wind_speed_10m;
    
    // Simple WMO code mapping
    let icon = "☁️";
    let desc = "Overskyet";
    if (wmoCode === 0) { icon = "☀️"; desc = "Klart"; }
    else if (wmoCode < 3) { icon = "⛅"; desc = "Let skyet"; }
    else if (wmoCode < 50) { icon = "🌫️"; desc = "Tåget"; }
    else if (wmoCode < 60) { icon = "🌧️"; desc = "Støvregn"; }
    else if (wmoCode < 70) { icon = "🌧️"; desc = "Regn"; }
    else if (wmoCode < 80) { icon = "🌨️"; desc = "Sne"; }
    else { icon = "⛈️"; desc = "Uvejr"; }

    return (
        <div className="bg-gradient-to-br from-brand-primary to-brand-strong text-white p-4 rounded-card shadow-md flex items-center justify-between relative overflow-hidden transition-all duration-500">
            <div className="relative z-10">
                {/* Project and Location Group */}
                <div className="mb-2">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                        <MapPinIcon className="w-4 h-4 text-white/70" />
                        <span>{weather.locationName}</span>
                        <span className="text-white/40 mx-1">|</span>
                        <div className="flex items-center gap-1 text-white/80 text-xs font-medium">
                            <FolderIcon className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{weather.projectName}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-4xl">{icon}</span>
                    <div>
                        <div className="text-2xl font-bold leading-none">{temp}°</div>
                        <div className="text-sm opacity-90">{desc}</div>
                    </div>
                </div>
            </div>
            <div className="text-right relative z-10">
                <div className="text-xs text-white/80">Vind</div>
                <div className={`font-semibold ${wind > 10 ? 'text-brand-accent' : 'text-white'}`}>{wind} m/s</div>
                <div className="text-xs text-white/80 mt-2">Nedbør</div>
                <div className="font-semibold">{current.precipitation} mm</div>
            </div>
            
            {/* Decorative Background Elements */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
            <div className="absolute left-10 -bottom-10 w-32 h-32 bg-brand-light opacity-20 rounded-full blur-xl"></div>
            
            {/* Progress Bar for timer if multiple locations */}
            {activeProjectsWithLocation.length > 1 && (
                <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full">
                     <div key={currentIndex} className="h-full bg-white/80 w-full origin-left animate-[shrink_12s_linear]"></div>
                </div>
            )}
            <style>{`
                @keyframes shrink {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `}</style>
        </div>
    );
};