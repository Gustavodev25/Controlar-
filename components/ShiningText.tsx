"use client"

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShiningTextProps {
    text: string;
    className?: string;
}

export function ShiningText({ text, className }: ShiningTextProps) {
    return (
        <motion.span
            className={cn(
                "bg-[linear-gradient(110deg,#D97757,45%,#fff,55%,#D97757)] bg-[length:200%_100%] bg-clip-text text-transparent inline-block",
                className
            )}
            initial={{ backgroundPosition: "200% 0" }}
            animate={{ backgroundPosition: "-200% 0" }}
            transition={{
                repeat: Infinity,
                duration: 2,
                ease: "linear",
            }}
        >
            {text}
        </motion.span>
    );
}
