import { useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// React layout effect hook fallback for SSR/Client compatibility
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Animate modal entrance with ultra-smooth spring physics
 */
export function animateModalPopup(containerEl, backdropEl) {
  if (!containerEl) return;
  const ctx = gsap.context(() => {
    if (backdropEl) {
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' }
      );
    }
    gsap.fromTo(
      containerEl,
      { opacity: 0, scale: 0.9, y: 30, transformOrigin: 'center center' },
      { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.5)', clearProps: 'transformOrigin' }
    );
  });
  return () => ctx.revert();
}

/**
 * Animate container items with staggering smooth motion
 */
export function animateStagger(elements, options = {}) {
  if (!elements || elements.length === 0) return;
  const { y = 20, duration = 0.4, stagger = 0.08, delay = 0 } = options;
  const ctx = gsap.context(() => {
    gsap.fromTo(
      elements,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, stagger, delay, ease: 'power3.out' }
    );
  });
  return () => ctx.revert();
}

/**
 * Add magnetic smooth hover effect to an interactive element
 */
export function attachSmoothHover(element, scaleAmount = 1.03, yOffset = -3) {
  if (!element) return;

  const onMouseEnter = () => {
    gsap.to(element, { scale: scaleAmount, y: yOffset, duration: 0.25, ease: 'power2.out' });
  };
  const onMouseLeave = () => {
    gsap.to(element, { scale: 1, y: 0, duration: 0.25, ease: 'power2.out' });
  };
  const onMouseDown = () => {
    gsap.to(element, { scale: 0.97, duration: 0.1, ease: 'power1.inOut' });
  };

  element.addEventListener('mouseenter', onMouseEnter);
  element.addEventListener('mouseleave', onMouseLeave);
  element.addEventListener('mousedown', onMouseDown);

  return () => {
    element.removeEventListener('mouseenter', onMouseEnter);
    element.removeEventListener('mouseleave', onMouseLeave);
    element.removeEventListener('mousedown', onMouseDown);
  };
}

export default gsap;
