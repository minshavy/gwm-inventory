import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Floating button that appears once the page is scrolled down a bit and
// smooth-scrolls back to the top when pressed. Used on pages where jumping
// down to a section (like Dashboard's Stock Alerts) would otherwise strand
// the person down there with no quick way back up.
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-30 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
