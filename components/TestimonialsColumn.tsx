import React from 'react';
import { motion } from 'framer-motion';

interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

interface TestimonialsColumnProps {
  testimonials: Testimonial[];
  className?: string;
  duration?: number;
}

export const TestimonialsColumn: React.FC<TestimonialsColumnProps> = ({
  testimonials,
  className = '',
  duration = 15
}) => {
  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <motion.div
        initial={{ translateY: '-50%' }}
        animate={{ translateY: '0' }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop'
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...testimonials, ...testimonials].map((testimonial, index) => (
          <div
            key={index}
            className="bg-gray-950 border border-gray-800 rounded-2xl p-6 hover:border-[#d97757]/30 transition-all group"
          >
            <p className="text-gray-300 text-sm leading-relaxed mb-6 group-hover:text-gray-200 transition-colors">
              "{testimonial.text}"
            </p>
            <div className="flex items-center gap-3">
              <img
                src={testimonial.image}
                alt={testimonial.name}
                className="w-12 h-12 rounded-full border-2 border-gray-800 group-hover:border-[#d97757]/50 transition-colors object-cover"
              />
              <div>
                <p className="text-white font-bold text-sm">{testimonial.name}</p>
                <p className="text-gray-500 text-xs">{testimonial.role}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};
