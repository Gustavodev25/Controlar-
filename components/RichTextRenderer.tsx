import React from 'react';

interface RichTextRendererProps {
    text: string;
    className?: string;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({ text, className }) => {
    if (!text) return null;

    // Regex to capture bold text enclosed in ** **
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return (
        <span className={className}>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                    const content = part.slice(2, -2);
                    // Using text-white/90 for bold to make it stand out slightly more if parent is gray
                    // But usually strong inherits, let's force a slightly brighter color if needed
                    // or just use font-bold.
                    return <strong key={i} className="font-bold text-white">{content}</strong>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};
