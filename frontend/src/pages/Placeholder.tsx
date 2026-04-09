import { Construction } from 'lucide-react';

export default function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Construction size={48} className="mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500">Coming in {phase}</p>
    </div>
  );
}
