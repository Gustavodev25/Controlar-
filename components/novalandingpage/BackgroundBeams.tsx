"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface AnimatedGradientBackgroundProps {
    className?: string;
    children?: React.ReactNode;
    intensity?: "subtle" | "medium" | "strong";
}

interface Beam {
    x: number;
    y: number;
    width: number;
    length: number;
    angle: number;
    speed: number;
    opacity: number;
    hue: number;
    pulse: number;
    pulseSpeed: number;
}

function createBeam(width: number, height: number): Beam {
    const angle = -35 + Math.random() * 10;
    // Set hue primarily to orange range (around 20-40) for #D97757 primarily
    const hue = 15 + Math.random() * 25;

    return {
        x: Math.random() * width * 1.5 - width * 0.25,
        y: Math.random() * height * 1.5 - height * 0.25,
        width: 30 + Math.random() * 60,
        length: height * 2.5,
        angle: angle,
        speed: 0.6 + Math.random() * 1.2,
        opacity: 0.12 + Math.random() * 0.16,
        hue: hue,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
    };
}

export function BeamsBackground({
    className,
    intensity = "strong",
    children,
}: AnimatedGradientBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const beamsRef = useRef<Beam[]>([]);
    const animationFrameRef = useRef<number>(0);
    const MINIMUM_BEAMS = 6;

    const opacityMap = {
        subtle: 0.7,
        medium: 0.85,
        strong: 1,
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const updateCanvasSize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);

            // Create exactly 6 beams: 3 left, 3 right
            const beams: Beam[] = [];
            const centerX = canvas.width / 2;
            const height = canvas.height;

            // Left side beams (pointing right-down towards center)
            // Origin: Left side. Target: Center Bottom. Needs negative rotation (Anti-clockwise from Down vector? No, Check canvas logic).
            // 0 deg = Down. 
            // -45 deg = Down-Right. (Counter-clockwise rotates the Y-axis to the right? Let's assume -45 points right-down).
            for (let i = 0; i < 3; i++) {
                beams.push({
                    x: -50, // Fixed at left corner
                    y: -750, // Much higher up
                    width: 60 + (i * 15),
                    length: height * 1.5, // Longer slightly to reach center
                    angle: -30 - (i * 8), // Fan out
                    speed: 0.2,
                    opacity: 0.5,
                    hue: 0,
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.01 + Math.random() * 0.01,
                });
            }

            // Right side beams (pointing left-down towards center)
            // Origin: Right side. Target: Center Bottom. Needs positive rotation.
            // 0 deg = Down.
            // +45 deg = Down-Left.
            for (let i = 0; i < 3; i++) {
                beams.push({
                    x: canvas.width + 50, // Fixed at right corner
                    y: -750, // Much higher up
                    width: 60 + (i * 15),
                    length: height * 1.5,
                    angle: 30 + (i * 8),
                    speed: 0.2,
                    opacity: 0.5,
                    hue: 0,
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.01 + Math.random() * 0.01,
                });
            }
            beamsRef.current = beams;
        };

        updateCanvasSize();
        window.addEventListener("resize", updateCanvasSize);

        function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
            ctx.save();
            ctx.translate(beam.x, beam.y);
            ctx.rotate((beam.angle * Math.PI) / 180);

            // Calculate pulsing opacity
            const pulsingOpacity =
                beam.opacity *
                (0.6 + Math.sin(beam.pulse) * 0.4) *
                opacityMap[intensity];

            const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);

            // Pure White gradient starting bright
            gradient.addColorStop(0, `hsla(0, 0%, 100%, ${pulsingOpacity * 0.4})`);
            gradient.addColorStop(0.1, `hsla(0, 0%, 100%, ${pulsingOpacity * 0.8})`);
            gradient.addColorStop(0.5, `hsla(0, 0%, 100%, ${pulsingOpacity})`);
            gradient.addColorStop(0.9, `hsla(0, 0%, 100%, ${pulsingOpacity * 0.2})`);
            gradient.addColorStop(1, `hsla(0, 0%, 100%, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
            ctx.restore();
        }

        function animate() {
            if (!canvas || !ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.filter = "blur(40px)"; // Heavier blur for 'spotlight' look

            beamsRef.current.forEach((beam) => {
                // Just pulse, don't move Y much, or wiggle slightly
                beam.pulse += beam.pulseSpeed;
                drawBeam(ctx, beam);
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        }

        animate();

        return () => {
            window.removeEventListener("resize", updateCanvasSize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [intensity]);

    return (
        <div
            className={cn(
                "relative min-h-screen w-full overflow-hidden bg-[#0f0402]",
                className
            )}
        >
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-0 pointer-events-none"
                style={{ filter: "blur(15px)" }}
            />

            <motion.div
                className="absolute inset-0 bg-[#0f0402]/5 z-0 pointer-events-none"
                animate={{
                    opacity: [0.05, 0.15, 0.05],
                }}
                transition={{
                    duration: 10,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                }}
                style={{
                    backdropFilter: "blur(50px)",
                }}
            />

            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
}
