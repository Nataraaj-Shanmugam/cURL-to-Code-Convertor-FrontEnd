import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <motion.section
      className="flex flex-col items-center justify-center text-center py-24 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        Modernized Frontend Playground
      </h1>

      <p className="max-w-xl text-muted-foreground">
        Experiment with HTTP requests in a clean, responsive interface.  
        Powered by React, Tailwind, Shadcn/UI, and Framer Motion.
      </p>

      <div className="flex gap-4 justify-center">
        <Link to="/playground">
          <Button>Open Playground</Button>
        </Link>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline">View Source</Button>
        </a>
      </div>
    </motion.section>
  );
}
