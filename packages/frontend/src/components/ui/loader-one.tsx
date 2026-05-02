import React from 'react';
import { motion } from 'framer-motion';

export const LoaderOne = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-brand-600 rounded-full"
            animate={{
              y: ["0%", "-50%", "0%"],
              opacity: [1, 0.5, 1]
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15
            }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        Buscando dados do Asaas...
      </p>
    </div>
  );
};
