import React, { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function SmoothScrollProvider({ children }) {
  useEffect(() => {
    // Create Lenis smooth scrolling instance driven by GSAP ticker
    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smoothTouch: false,
      prevent: (node) => {
        // Prevent Lenis scroll hijacking when scrolling inside modals, textareas, or nested overflow containers
        if (!node) return false;
        return (
          node.closest('[data-lenis-prevent]') !== null ||
          node.closest('.overflow-y-auto') !== null ||
          node.tagName === 'TEXTAREA' ||
          node.tagName === 'SELECT'
        );
      }
    });

    // Update ScrollTrigger on Lenis scroll
    lenis.on('scroll', ScrollTrigger.update);

    // Ticker integration for 60fps frame-locked smoothness
    const tick = (time) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
