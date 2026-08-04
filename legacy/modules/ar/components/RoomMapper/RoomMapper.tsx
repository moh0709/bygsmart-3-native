
// @ts-nocheck
import React, { useState, useRef, useEffect, ErrorInfo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, ARButton, Interactive, useHitTest, useXR } from '@react-three/xr';
import { Line, Html, Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MapperUI } from './MapperUI';
import { FloorPlan, MappedElement, MappedElementType } from '../../../../types';
import { AlertTriangleIcon, CameraIcon, RefreshCwIcon, XIcon } from '../../../../components/icons';

// Fix for JSX.IntrinsicElements in React Three Fiber
declare global {
    namespace JSX {
        interface IntrinsicElements {
            mesh: any;
            group: any;
            sphereGeometry: any;
            meshBasicMaterial: any;
            ringGeometry: any;
            planeGeometry: any;
            ambientLight: any;
            pointLight: any;
            directionalLight: any;
            primitive: any;
            // Allow any other elements
            [elemName: string]: any;
        }
    }
}

interface RoomMapperProps {
    onSave: (plan: FloorPlan) => void;
    onClose: () => void;
}

// --- Video Feed Component (iOS / Non-WebXR Fallback) ---
const VideoFeed = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startVideo = async () => {
            try {
                // Request back camera with HD preference
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // iOS requires playsInline for video to play inline
                    videoRef.current.setAttribute('playsinline', 'true');
                    videoRef.current.setAttribute('webkit-playsinline', 'true');
                    await videoRef.current.play();
                }
            } catch (err) {
                console.warn("Could not access camera via getUserMedia", err);
                setError("Kunne ikke tilgå kamera. Tjek tilladelser.");
            }
        };

        startVideo();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    if (error) {
        return <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-900 p-4 text-center">{error}</div>;
    }

    return (
        <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 w-full h-full object-cover -z-10"
            style={{ pointerEvents: 'none' }}
        />
    );
};

// --- 2D Fallback Mapper (No WebGL Required) ---
const Simple2DMapper: React.FC<{
    points: THREE.Vector3[];
    elements: MappedElement[];
    onAddPoint: (pos: THREE.Vector3) => void;
}> = ({ points, elements, onAddPoint }) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const PIXELS_PER_METER = 100; // Scale: 100px = 1m

    // Convert internal meter coordinates to screen pixels relative to center
    const toScreen = (v: { x: number, z: number }) => ({
        x: cx + v.x * PIXELS_PER_METER,
        y: cy + v.z * PIXELS_PER_METER
    });

    const handleClick = (e: React.MouseEvent) => {
        // Convert click to meters relative to center
        const x = (e.clientX - cx) / PIXELS_PER_METER;
        const z = (e.clientY - cy) / PIXELS_PER_METER;
        onAddPoint(new THREE.Vector3(x, 0, z));
    };

    return (
        <div className="absolute inset-0 z-10 w-full h-full" onClick={handleClick}>
            <svg className="w-full h-full">
                <defs>
                    <pattern id="grid2d" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                    </pattern>
                </defs>

                {/* Background Grid Hint */}
                <rect width="100%" height="100%" fill="url(#grid2d)" />

                {/* Drawn Elements */}
                {elements.map(el => {
                    const s = toScreen(el.start);
                    const e = toScreen(el.end);
                    const color = el.type === 'window' ? '#3b82f6' : el.type === 'door' ? '#f97316' : 'white';

                    return (
                        <g key={el.id}>
                            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={color} strokeWidth="4" strokeLinecap="round" />
                            {/* Length Label */}
                            <rect x={(s.x + e.x) / 2 - 20} y={(s.y + e.y) / 2 - 10} width="40" height="16" rx="4" fill="rgba(0,0,0,0.6)" />
                            <text x={(s.x + e.x) / 2} y={(s.y + e.y) / 2} fill="white" fontSize="10" textAnchor="middle" dy="3" fontWeight="bold">
                                {el.length.toFixed(2)}m
                            </text>

                            {/* End markers */}
                            <circle cx={s.x} cy={s.y} r="3" fill="white" />
                            <circle cx={e.x} cy={e.y} r="3" fill="white" />
                        </g>
                    );
                })}

                {/* Active Points */}
                {points.map((p, i) => {
                    const s = toScreen(p);
                    return <circle key={i} cx={s.x} cy={s.y} r="6" fill="#FFB020" stroke="white" strokeWidth="2" />;
                })}

                {/* Connection Preview */}
                {points.length > 0 && (
                    <line
                        x1={toScreen(points[points.length - 1]).x}
                        y1={toScreen(points[points.length - 1]).y}
                        x2={cx}
                        y2={cy}
                        stroke="#FFB020"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        opacity="0.5"
                    />
                )}
            </svg>

            <div className="absolute bottom-32 left-0 right-0 text-center pointer-events-none">
                <span className="bg-black/60 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
                    2D Mode: Tap for at sætte punkter
                </span>
            </div>

            {/* Center Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-6 h-0.5 bg-white/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                <div className="h-6 w-0.5 bg-white/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            </div>
        </div>
    );
};

// --- Error Boundary for 3D Context ---
interface ErrorBoundaryProps {
    children?: React.ReactNode;
    fallback: () => void;
}

class CanvasErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
    state = { hasError: false };
    public readonly props!: ErrorBoundaryProps & { children?: React.ReactNode };

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: ErrorInfo) {
        console.error("3D Context Crashed, switching to fallback:", error);
        this.props.fallback();
    }

    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}

// --- XR Status Watcher ---
// This component sits inside the XR context and syncs the session state with the UI
const XRStatusWatcher: React.FC<{ onChange: (isPresenting: boolean) => void }> = ({ onChange }) => {
    const { isPresenting, session } = useXR();

    // React to immediate state change from useXR hook
    useEffect(() => {
        onChange(isPresenting);
    }, [isPresenting, onChange]);

    // Robust listener for session ending (e.g. back button in browser)
    useEffect(() => {
        if (session) {
            const handleEnd = () => onChange(false);
            session.addEventListener('end', handleEnd);
            return () => session.removeEventListener('end', handleEnd);
        }
    }, [session, onChange]);

    return null;
}

// --- 3D Components ---
const Marker: React.FC<{ position: THREE.Vector3, color: string }> = ({ position, color }) => {
    return (
        <mesh position={position}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={color} depthTest={false} opacity={0.8} transparent />
        </mesh>
    );
};

const WallSegment: React.FC<{ start: THREE.Vector3, end: THREE.Vector3, type: MappedElementType }> = ({ start, end, type }) => {
    const color = type === 'wall' ? '#ffffff' : type === 'window' ? '#3b82f6' : '#f97316';
    const height = 1.0;
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const len = start.distanceTo(end);

    return (
        <group>
            <Line points={[start, end]} color={color} lineWidth={4} />
            <Line points={[start, new THREE.Vector3(start.x, start.y + height, start.z)]} color={color} lineWidth={1} dashed opacity={0.5} />
            <Line points={[end, new THREE.Vector3(end.x, end.y + height, end.z)]} color={color} lineWidth={1} dashed opacity={0.5} />
            <Html position={[mid.x, mid.y + 0.2, mid.z]} center>
                <div className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none whitespace-nowrap">
                    {len.toFixed(2)}m
                </div>
            </Html>
        </group>
    );
};

const Reticle = ({ onPlace, onMove }: { onPlace: (pos: THREE.Vector3) => void, onMove: (pos: THREE.Vector3) => void }) => {
    const ref = useRef<THREE.Mesh>(null!);
    useHitTest((hitMatrix, hit) => {
        if (ref.current) {
            hitMatrix.decompose(ref.current.position, ref.current.quaternion, ref.current.scale);
            ref.current.rotation.x = -Math.PI / 2;
            onMove(ref.current.position.clone());
        }
    });
    return (
        <Interactive onSelect={() => ref.current && onPlace(ref.current.position.clone())}>
            <mesh ref={ref} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.08, 0.1, 32]} />
                <meshBasicMaterial color="#FFB020" />
            </mesh>
        </Interactive>
    );
};

const StudioScene = ({ onPlace, onMove }: { onPlace: (pos: THREE.Vector3) => void, onMove: (pos: THREE.Vector3) => void }) => {
    const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);

    const handlePointerMove = (e: any) => {
        const point = e.point.clone();
        point.y = 0;
        setHoverPos(point);
        onMove(point);
    };

    const handleClick = (e: any) => {
        const point = e.point.clone();
        point.y = 0;
        onPlace(point);
    };

    return (
        <>
            <Grid infiniteGrid sectionColor="#555" cellColor="#777" fadeDistance={30} sectionSize={1} cellSize={0.5} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 20, 5]} intensity={1} />
            <OrbitControls makeDefault enableRotate={false} enableZoom={false} enablePan={true} />
            <mesh rotation-x={-Math.PI / 2} onPointerMove={handlePointerMove} onClick={handleClick} visible={false}>
                <planeGeometry args={[100, 100]} />
            </mesh>
            {hoverPos && (
                <mesh position={[hoverPos.x, 0.01, hoverPos.z]} rotation-x={-Math.PI / 2}>
                    <ringGeometry args={[0.1, 0.15, 32]} />
                    <meshBasicMaterial color="#FFB020" />
                </mesh>
            )}
        </>
    );
};

// --- Main Component ---

export const RoomMapper: React.FC<RoomMapperProps> = ({ onSave, onClose }) => {
    const [points, setPoints] = useState<THREE.Vector3[]>([]);
    const [elements, setElements] = useState<MappedElement[]>([]);
    const [currentMode, setCurrentMode] = useState<MappedElementType>('wall');
    const [isAR, setIsAR] = useState(false);
    const [mode3D, setMode3D] = useState(true);
    const [sessionStarted, setSessionStarted] = useState(false);
    const [isStartingAR, setIsStartingAR] = useState(false);
    const [force2D, setForce2D] = useState(false);

    // Live Measurement & Trace Logic
    const [currentReticlePos, setCurrentReticlePos] = useState<THREE.Vector3 | null>(null);
    const [isTracing, setIsTracing] = useState(false);

    // Refs for stable access in AR loop (Critical for auto-trace)
    const isTracingRef = useRef(false);
    const lastTracePoint = useRef<THREE.Vector3 | null>(null);
    const currentModeRef = useRef<MappedElementType>('wall');
    const TRACE_THRESHOLD = 0.05; // 5cm

    // Sync refs with state
    useEffect(() => {
        isTracingRef.current = isTracing;
    }, [isTracing]);

    useEffect(() => {
        currentModeRef.current = currentMode;
    }, [currentMode]);

    useEffect(() => {
        if ('xr' in navigator) {
            // @ts-ignore
            navigator.xr?.isSessionSupported('immersive-ar').then(supported => setIsAR(supported)).catch(() => setIsAR(false));
        }
        if (force2D) setMode3D(false);
    }, [force2D]);

    // Safety timeout for AR starting - Automatic Fallback
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (isStartingAR) {
            // Wait 4 seconds max for AR session to initialize
            timeout = setTimeout(() => {
                if (!sessionStarted) {
                    console.warn("AR Session start timed out - falling back to 2D");
                    handleSwitchTo2D();
                }
            }, 4000);
        }
        return () => clearTimeout(timeout);
    }, [isStartingAR, sessionStarted]);

    // Handle session state synchronization
    const handleSessionStateChange = useCallback((isPresenting: boolean) => {
        setSessionStarted(isPresenting);
        if (isPresenting) {
            setIsStartingAR(false);
        } else {
            setIsStartingAR(false);
        }
    }, []);

    const handleSwitchTo2D = useCallback(() => {
        setForce2D(true);
        setMode3D(false);
        setSessionStarted(true);
        setIsStartingAR(false);
    }, []);

    // Stable function to add points without recreating on every render
    const handleAddPoint = useCallback((pos: THREE.Vector3) => {
        setPoints(currentPoints => {
            const newPoint = pos.clone();
            const mode = currentModeRef.current; // Use ref to avoid dependency cycle

            // Auto-snap close logic
            if (currentPoints.length > 2 && !isTracingRef.current) {
                const start = currentPoints[0];
                if (newPoint.distanceTo(start) < 0.2) {
                    const newEl: MappedElement = {
                        id: `el-${Date.now()}`,
                        type: mode,
                        start: { x: currentPoints[currentPoints.length - 1].x, y: currentPoints[currentPoints.length - 1].y, z: currentPoints[currentPoints.length - 1].z },
                        end: { x: start.x, y: start.y, z: start.z },
                        length: currentPoints[currentPoints.length - 1].distanceTo(start),
                        timestamp: Date.now()
                    };
                    setElements(prev => [...prev, newEl]);
                    return [];
                }
            }

            if (currentPoints.length > 0) {
                const last = currentPoints[currentPoints.length - 1];
                const newEl: MappedElement = {
                    id: `el-${Date.now()}`,
                    type: mode,
                    start: { x: last.x, y: last.y, z: last.z },
                    end: { x: newPoint.x, y: newPoint.y, z: newPoint.z },
                    length: last.distanceTo(newPoint),
                    timestamp: Date.now()
                };
                setElements(prev => [...prev, newEl]);
            }

            return [...currentPoints, newPoint];
        });
    }, []);

    // This callback runs every frame in AR
    const handleReticleMove = useCallback((pos: THREE.Vector3) => {
        setCurrentReticlePos(pos);

        // Critical: Logic runs in AR loop, must not depend on changing state
        if (isTracingRef.current) {
            const anchor = lastTracePoint.current;

            if (anchor) {
                if (pos.distanceTo(anchor) > TRACE_THRESHOLD) {
                    handleAddPoint(pos);
                    lastTracePoint.current = pos;
                }
            } else {
                // First point
                handleAddPoint(pos);
                lastTracePoint.current = pos;
            }
        }
    }, [handleAddPoint]);

    const handleUndo = () => {
        if (points.length === 0 && elements.length > 0) {
            const lastEl = elements[elements.length - 1];
            setPoints([new THREE.Vector3(lastEl.start.x, lastEl.start.y, lastEl.start.z), new THREE.Vector3(lastEl.end.x, lastEl.end.y, lastEl.end.z)]);
            setElements(prev => prev.slice(0, -1));
            return;
        }
        if (points.length > 0) {
            setPoints(prev => prev.slice(0, -1));
            if (elements.length > 0) setElements(prev => prev.slice(0, -1));
        }
        lastTracePoint.current = null;
    };

    const handleReset = () => {
        // Immediate reset, no confirm dialog to avoid blocking AR session
        setPoints([]);
        setElements([]);
        setIsTracing(false);
        isTracingRef.current = false;
        lastTracePoint.current = null;
    };

    const handleFinish = () => {
        const totalPerimeter = elements.reduce((sum, el) => sum + el.length, 0);
        let area = 0;
        if (elements.length > 2) {
            let j = elements.length - 1;
            for (let i = 0; i < elements.length; i++) {
                area += (elements[j].start.x + elements[i].start.x) * (elements[j].start.z - elements[i].start.z);
                j = i;
            }
            area = Math.abs(area / 2.0);
        }

        const plan: FloorPlan = {
            id: `plan-${Date.now()}`,
            elements,
            createdAt: new Date().toISOString(),
            totalPerimeter,
            estimatedArea: area > 0 ? area : 0
        };

        onSave(plan);
    };

    const toggleTracing = () => {
        const newState = !isTracing;
        setIsTracing(newState);
        isTracingRef.current = newState;

        if (newState) {
            lastTracePoint.current = points.length > 0 ? points[points.length - 1] : null;
        } else {
            lastTracePoint.current = null;
        }
    };

    const stats = {
        length: elements.reduce((s, e) => s + e.length, 0),
        count: elements.length
    };

    let liveDistance = 0;
    if (points.length > 0 && currentReticlePos) {
        liveDistance = points[points.length - 1].distanceTo(currentReticlePos);
    }

    return (
        <div className={`fixed inset-0 z-[100] ${sessionStarted ? 'bg-transparent' : 'bg-bg-dark'}`}>
            {/* Show video if session started AND (not AR supported OR forced 2D) */}
            {sessionStarted && (!isAR || !mode3D) && <VideoFeed />}

            {sessionStarted && (
                <MapperUI
                    currentMode={currentMode}
                    onSetMode={setCurrentMode}
                    onUndo={handleUndo}
                    onReset={handleReset}
                    onClose={onClose}
                    onFinish={handleFinish}
                    canUndo={elements.length > 0 || points.length > 0}
                    canFinish={elements.length > 0}
                    stats={stats}
                    isAR={isAR && mode3D}
                    liveDistance={liveDistance}
                    isTracing={isTracing}
                    onToggleTrace={toggleTracing}
                />
            )}

            {/* Loading / Start Screen */}
            {!sessionStarted && !force2D && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6 text-center pointer-events-auto">
                    <div className="bg-white/10 p-4 rounded-full mb-6">
                        <CameraIcon className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Klar til Opmåling</h2>
                    <p className="text-text-dark-secondary mb-8 max-w-xs">
                        Start for at måle rummet med kameraet.
                    </p>

                    {isAR ? (
                        <div onClickCapture={() => setIsStartingAR(true)}>
                            <ARButton
                                className={`bg-brand-primary hover:bg-brand-strong text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center gap-3 transform transition-transform ${isStartingAR ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                                sessionInit={{ requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } }}
                                disabled={isStartingAR}
                            >
                                {isStartingAR ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                        Starter AR...
                                    </>
                                ) : "Start AR Mode"}
                            </ARButton>
                        </div>
                    ) : (
                        <div className="space-y-3 w-full max-w-xs">
                            <button onClick={() => setSessionStarted(true)} className="w-full bg-brand-primary hover:bg-brand-strong text-white font-bold py-4 px-8 rounded-full shadow-2xl flex items-center justify-center gap-3 transform transition-transform hover:scale-105">
                                Start Kamera
                            </button>
                            <button onClick={handleSwitchTo2D} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-full shadow border border-white/20 flex items-center justify-center gap-2">
                                Brug 2D Mode (Backup)
                            </button>
                        </div>
                    )}

                    {isStartingAR && (
                        <button onClick={() => setIsStartingAR(false)} className="mt-8 flex items-center gap-2 text-white/70 hover:text-white bg-white/10 px-4 py-2 rounded-full text-xs font-semibold">
                            <XIcon className="w-3 h-3" /> Annuller
                        </button>
                    )}

                    {!isStartingAR && (
                        <button onClick={onClose} className="mt-8 text-text-dark-tertiary text-sm font-semibold underline">
                            Luk
                        </button>
                    )}
                </div>
            )}

            {mode3D ? (
                <CanvasErrorBoundary fallback={handleSwitchTo2D}>
                    <Canvas gl={{ alpha: true, precision: 'mediump', preserveDrawingBuffer: true, antialias: true }} camera={!isAR ? { position: [0, 8, 0], fov: 50 } : undefined}>
                        {isAR ? (
                            <XR>
                                <XRStatusWatcher onChange={handleSessionStateChange} />
                                <ambientLight intensity={0.5} />
                                <pointLight position={[10, 10, 10]} />
                                {elements.map(el => (
                                    <WallSegment key={el.id} start={new THREE.Vector3(el.start.x, el.start.y, el.start.z)} end={new THREE.Vector3(el.end.x, el.end.y, el.end.z)} type={el.type} />
                                ))}
                                {points.length > 0 && currentReticlePos && (
                                    <Line points={[points[points.length - 1], currentReticlePos]} color={isTracing ? "#ef4444" : "#FFB020"} lineWidth={2} dashed dashSize={0.1} gapSize={0.05} />
                                )}
                                {points.map((p, i) => <Marker key={i} position={p} color={i === 0 ? 'green' : 'white'} />)}
                                <Reticle onPlace={handleAddPoint} onMove={handleReticleMove} />
                                {currentReticlePos && liveDistance > 0 && (
                                    <Html position={[currentReticlePos.x, currentReticlePos.y + 0.15, currentReticlePos.z]}>
                                        <div className="bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap">
                                            {liveDistance.toFixed(2)}m
                                        </div>
                                    </Html>
                                )}
                            </XR>
                        ) : (
                            sessionStarted && (
                                <>
                                    <ambientLight intensity={0.5} />
                                    <pointLight position={[10, 10, 10]} />
                                    {elements.map(el => (
                                        <WallSegment key={el.id} start={new THREE.Vector3(el.start.x, el.start.y, el.start.z)} end={new THREE.Vector3(el.end.x, el.end.y, el.end.z)} type={el.type} />
                                    ))}
                                    {points.map((p, i) => <Marker key={i} position={p} color={i === 0 ? 'green' : 'white'} />)}
                                    <StudioScene onPlace={handleAddPoint} onMove={handleReticleMove} />
                                </>
                            )
                        )}
                    </Canvas>
                </CanvasErrorBoundary>
            ) : (
                sessionStarted && <Simple2DMapper points={points} elements={elements} onAddPoint={handleAddPoint} />
            )}

            {sessionStarted && mode3D && !isAR && (
                <button
                    onClick={handleSwitchTo2D}
                    className="absolute top-20 right-4 z-50 bg-black/40 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/60"
                    title="Skift til 2D"
                >
                    <RefreshCwIcon className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};
