import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MousePointer2, CheckCircle2, AlertCircle } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 rounded-full px-8 py-4 flex items-center gap-12 ${
      scrolled ? 'bg-[#F5F3EE]/60 backdrop-blur-xl border border-[#E8E4DD] shadow-lg text-black' : 'bg-transparent text-white'
    }`}>
      <div className="font-display text-xl tracking-tight font-bold">TASKFORGE</div>
      <div className="flex gap-8 font-sans text-sm font-medium">
        <a href="#features" className="hover:text-signal-red transition-colors">Features</a>
        <a href="#philosophy" className="hover:text-signal-red transition-colors">Philosophy</a>
        <a href="#pricing" className="hover:text-signal-red transition-colors">Pricing</a>
      </div>
      <Link to="/login" className="btn-brutal bg-black text-white px-6 py-2 rounded-full font-sans text-sm font-medium">
        <span className="relative z-10">Login</span>
      </Link>
    </nav>
  );
};

const Hero = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-text', 
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.08, ease: 'power3.out', delay: 0.2 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative h-[100dvh] w-full overflow-hidden flex items-end p-12 md:p-24">
      <div className="absolute inset-0 bg-black">
        <img 
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" 
          alt="Concrete structure" 
          className="w-full h-full object-cover opacity-60 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
      </div>
      
      <div className="relative z-10 text-white max-w-4xl">
        <div className="hero-text mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-signal-red/10 border border-signal-red/30 backdrop-blur-md font-mono text-[#FF7066] text-xs tracking-wider font-semibold uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-red animate-pulse"></span>
          TASKFORGE — PRECISION TASK ENGINE
        </div>
        <h1 className="hero-text font-sans font-extrabold text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-tight mb-2 text-white">Command the</h1>
        <h2 className="hero-text font-display italic text-7xl md:text-9xl lg:text-[11rem] leading-none mb-12 bg-gradient-to-r from-white via-[#E8E4DD] to-white/60 bg-clip-text text-transparent drop-shadow-sm">Workflow.</h2>
        <Link to="/signup" className="hero-text btn-brutal bg-signal-red text-white text-lg md:text-xl px-10 py-5 rounded-full font-medium inline-block">
          <span className="relative z-10">Start Managing Free</span>
        </Link>
      </div>
    </section>
  );
};

const FeatureCards = () => {
  const [cards, setCards] = useState(['All Tasks', 'In Progress', 'Overdue']);
  const containerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCards(prev => {
        const newCards = [...prev];
        const last = newCards.pop();
        newCards.unshift(last);
        return newCards;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const [feedText, setFeedText] = useState('');
  const fullText = "SYS_AUTH: Role verified. ADMIN permissions granted. Injecting task payload... Success.";
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setFeedText(fullText.substring(0, i));
      i++;
      if (i > fullText.length) {
        setTimeout(() => { i = 0; }, 2000);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="features" className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Card 1 */}
        <div className="bg-[#F5F3EE] rounded-[2rem] p-8 border border-[#E8E4DD] shadow-xl overflow-hidden relative h-96 flex flex-col justify-between">
          <div className="relative h-48 mt-4">
            {cards.map((card, i) => (
              <div 
                key={card}
                className="absolute w-full bg-white p-4 rounded-xl border border-[#E8E4DD] shadow-sm transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center gap-3"
                style={{
                  top: `${i * 20}px`,
                  scale: 1 - i * 0.05,
                  zIndex: 3 - i,
                  opacity: 1 - i * 0.2
                }}
              >
                {card === 'Overdue' ? <AlertCircle className="text-signal-red" /> : <CheckCircle2 className="text-black/50" />}
                <span className="font-sans font-medium">{card}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-display italic text-3xl mb-2">Diagnostic Shuffler</h3>
            <p className="font-mono text-xs text-black/60">Real-time task visibility array.</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-[#F5F3EE] rounded-[2rem] p-8 border border-[#E8E4DD] shadow-xl h-96 flex flex-col justify-between">
          <div className="bg-black text-green-400 p-6 rounded-2xl h-48 font-mono text-sm overflow-hidden flex items-start">
            <p>{feedText}<span className="inline-block w-2 h-4 bg-signal-red animate-pulse ml-1 align-middle"></span></p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-signal-red animate-pulse"></div>
              <h3 className="font-display italic text-3xl">Telemetry Feed</h3>
            </div>
            <p className="font-mono text-xs text-black/60">Role-based access telemetry.</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#F5F3EE] rounded-[2rem] p-8 border border-[#E8E4DD] shadow-xl h-96 flex flex-col justify-between relative group">
          <div className="grid grid-cols-7 gap-1 h-32 mt-8" spellCheck="false">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="flex flex-col gap-2 items-center" spellCheck="false">
                <span className="font-mono text-xs text-black/40" spellCheck="false">{d}</span>
                <div className={`w-8 h-8 rounded-lg border border-[#E8E4DD] ${i===3 ? 'bg-signal-red/10 border-signal-red' : 'bg-white'}`}></div>
              </div>
            ))}
          </div>
          <MousePointer2 className="absolute text-black w-6 h-6 z-10 transition-all duration-1000 ease-in-out group-hover:translate-x-[120px] group-hover:-translate-y-[80px] top-1/2 left-1/4" />
          <div>
            <h3 className="font-display italic text-3xl mb-2">Cursor Protocol</h3>
            <p className="font-mono text-xs text-black/60">Smart deadline allocation.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Philosophy = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.phil-word',
        { opacity: 0, y: 20 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.8, 
          stagger: 0.1, 
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 60%',
          }
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="philosophy" ref={containerRef} className="relative py-40 bg-black text-white overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-fixed" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=2000&auto=format&fit=crop)', backgroundSize: 'cover' }}></div>
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <p className="font-mono text-sm md:text-base text-white/50 mb-8 tracking-widest uppercase">
          {"Most tools focus on: adding features.".split(' ').map((word, i) => <span key={i} className="phil-word inline-block mr-2">{word}</span>)}
        </p>
        <h2 className="font-display italic text-5xl md:text-7xl lg:text-9xl leading-tight">
          {"We focus on: ".split(' ').map((word, i) => <span key={i} className="phil-word inline-block mr-4">{word}</span>)}
          <span className="phil-word inline-block text-[#FF7066]">clarity.</span>
        </h2>
      </div>
    </section>
  );
};

const Protocol = () => {
  const cardsData = [
    { num: '01', title: 'CREATE', desc: 'Spin up a project in seconds. Invite your team by email.', visual: <div className="w-64 h-64 border border-black rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]"><div className="w-48 h-48 border border-black rounded-full flex items-center justify-center"><div className="w-32 h-32 border border-signal-red rounded-full"></div></div></div> },
    { num: '02', title: 'ASSIGN', desc: 'Drag tasks to teammates. Set priority and deadlines.', visual: <div className="relative w-64 h-64 border border-black grid grid-cols-4 grid-rows-4 gap-4 p-4"><div className="absolute top-0 left-0 w-full h-1 bg-signal-red animate-[bounce_2s_infinite]"></div>{[...Array(16)].map((_,i)=><div key={i} className="bg-black/10 rounded-sm"></div>)}</div> },
    { num: '03', title: 'TRACK', desc: 'Live status board. Know exactly what\'s done and what\'s not.', visual: <svg className="w-64 h-32 stroke-signal-red stroke-2 fill-none animate-pulse" viewBox="0 0 100 50"><path d="M0 25 L20 25 L30 10 L40 40 L50 25 L100 25" /></svg> }
  ];

  return (
    <section className="relative bg-off-white py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-display italic text-5xl md:text-6xl mb-4">How It Works</h2>
          <p className="font-mono text-black/50 text-sm tracking-widest uppercase">Three steps to precision workflow</p>
        </div>
        <div className="space-y-12">
          {cardsData.map((card, i) => (
            <div key={i} className="bg-[#F5F3EE] rounded-[2rem] border border-[#E8E4DD] shadow-xl p-10 md:p-16">
              <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
                <div className="flex-1 flex justify-center">{card.visual}</div>
                <div className="flex-1">
                  <div className="font-mono text-signal-red text-xl mb-4">{card.num} / {card.title}</div>
                  <h2 className="font-display italic text-5xl md:text-7xl mb-6">{card.title}.</h2>
                  <p className="font-sans text-xl md:text-2xl text-black/70 max-w-md leading-relaxed">{card.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  return (
    <section id="pricing" className="py-32 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-20">
        <h2 className="font-display italic text-6xl mb-4 dark:text-white">Access Protocol</h2>
        <p className="font-mono text-black/60 dark:text-zinc-400">Select your operational tier.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Tier 1 */}
        <div className="bg-[#F5F3EE] dark:bg-[#0F0F12] rounded-[2rem] p-10 border border-[#E8E4DD] dark:border-zinc-800/80 shadow-lg text-black dark:text-zinc-100">
          <h3 className="font-sans font-bold text-2xl mb-2">Essential</h3>
          <div className="font-mono text-4xl mb-8">Free</div>
          <ul className="space-y-4 font-sans text-black/70 dark:text-zinc-400 mb-10">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-black dark:text-zinc-300" /> 3 Projects</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-black dark:text-zinc-300" /> 5 Members</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-black dark:text-zinc-300" /> Basic Dashboard</li>
          </ul>
          <Link to="/signup" className="btn-brutal block w-full py-4 text-center border border-black dark:border-zinc-700 rounded-full font-medium dark:text-zinc-200">
            <span className="relative z-10">Select Plan</span>
          </Link>
        </div>

        {/* Tier 2 */}
        <div className="bg-signal-red text-white rounded-[2rem] p-12 shadow-2xl scale-105 relative z-10">
          <h3 className="font-sans font-bold text-2xl mb-2">Performance</h3>
          <div className="font-mono text-4xl mb-8">$12<span className="text-xl">/mo</span></div>
          <ul className="space-y-4 font-sans text-white/90 mb-10">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Unlimited Projects</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> 25 Members</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Full Analytics</li>
          </ul>
          <Link to="/signup" className="btn-brutal block w-full py-4 text-center bg-black text-white rounded-full font-medium">
            <span className="relative z-10">Get Started</span>
          </Link>
        </div>

        {/* Tier 3 */}
        <div className="bg-[#F5F3EE] dark:bg-[#0F0F12] rounded-[2rem] p-10 border border-[#E8E4DD] dark:border-zinc-800/80 shadow-lg text-black dark:text-zinc-100">
          <h3 className="font-sans font-bold text-2xl mb-2">Enterprise</h3>
          <div className="font-mono text-4xl mb-8">Custom</div>
          <ul className="space-y-4 font-sans text-black/70 dark:text-zinc-400 mb-10">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-black dark:text-zinc-300" /> Unlimited Everything</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-black dark:text-zinc-300" /> SSO Integration</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-black dark:text-zinc-300" /> Priority Support</li>
          </ul>
          <a href="mailto:contact@taskforge.com" className="btn-brutal block w-full py-4 text-center border border-black dark:border-zinc-700 rounded-full font-medium dark:text-zinc-200">
            <span className="relative z-10">Contact Sales</span>
          </a>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-black text-white rounded-t-[4rem] px-12 py-20 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <div className="font-display text-3xl tracking-tight font-bold mb-4">TASKFORGE</div>
          <p className="font-mono text-white/50 max-w-sm mb-8">A precision instrument for teams. Control your workflow with brutal efficiency.</p>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="font-mono text-xs tracking-widest text-white/50">SYSTEM OPERATIONAL</span>
          </div>
        </div>
        <div>
          <h4 className="font-sans font-bold mb-6">Navigation</h4>
          <ul className="space-y-3 font-sans text-white/60">
            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
            <li><a href="#philosophy" className="hover:text-white transition-colors">Philosophy</a></li>
            <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-sans font-bold mb-6">Legal</h4>
          <ul className="space-y-3 font-sans text-white/60">
            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-off-white">
      <Navbar />
      <Hero />
      <FeatureCards />
      <Philosophy />
      <Protocol />
      <Pricing />
      <Footer />
    </div>
  );
}
