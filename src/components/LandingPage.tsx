import React, { useState } from 'react';
import { 
  Map, ShieldCheck, Truck, Clock, Building2, Users, 
  Activity, AlertTriangle, ArrowRight, X, Mail, Phone, 
  Twitter, Linkedin, Github
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = () => {
    setScrolled(window.scrollY > 20);
  };

  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Failure-Resilient Routing',
      desc: 'Precomputed fallback candidates keep aid moving even when shelters close mid-transit.',
    },
    {
      icon: <Truck className="w-6 h-6" />,
      title: 'Capacity-Aware Dispatch',
      desc: 'Deterministic engine splits cargo across riders without exceeding vehicle or shelter limits.',
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Safe-Use Deadlines',
      desc: 'Real-time rescue clock tracks perishable windows and triggers intervention before expiry.',
    },
    {
      icon: <Building2 className="w-6 h-6" />,
      title: 'Shelter Network',
      desc: 'Monitor occupancy, resources, and demand across the full receiving shelter network.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Rider Fleet',
      desc: 'Track volunteer riders, vehicle types, capacities, and live custody status.',
    },
    {
      icon: <Activity className="w-6 h-6" />,
      title: 'Audit Event Log',
      desc: 'Every dispatch, rescue, and state change is recorded for full operational traceability.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7F8] text-[#102A43] font-sans flex flex-col">
      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <Map className="w-7 h-7 text-teal-600" />
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                Civora
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <a href="#features" className="hover:text-teal-600 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-teal-600 transition-colors">
                How It Works
              </a>
              <a href="#scenarios" className="hover:text-teal-600 transition-colors">
                Scenarios
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors">
                Log in
              </a>
              <button
                onClick={onEnterApp}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                Enter Command Center
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-teal-50/40 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/2 translate-x-1/2 w-full h-full bg-slate-100/60 rounded-full blur-[120px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold mb-6 border border-teal-100">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Demo Available</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 tracking-tight mb-6 leading-tight">
            Resilient Aid Logistics,<br />
            <span className="text-teal-600">Without the Guesswork.</span>
          </h1>
          <p className="text-lg lg:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            A failure-resilient micro-logistics coordination platform for surplus cooked food and emergency aid.
            Leaflet GPS mapping, precomputed fallback candidates, rescue clock, and cargo-aware recovery.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onEnterApp}
              className="px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-lg font-semibold shadow-lg shadow-teal-200 transition-all transform hover:scale-[1.02]"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Start Coordinating
            </button>
            <button
              className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-lg font-semibold shadow-sm hover:bg-slate-50 transition-all"
            >
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Built for Aid Logistics</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to move surplus food from donor to shelter — safely, deterministically, and on time.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-[#F5F7F8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How Civora Works</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From surplus to shelter in four deterministic steps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Donor Offers Surplus', desc: 'Batches of cooked meals or perishables are registered with safe-use deadlines.' },
              { step: '2', title: 'Capacity-Aware Dispatch', desc: 'Engine allocates cargo across riders and shelters within vehicle and demand limits.' },
              { step: '3', title: 'Live GPS Tracking', desc: 'Leaflet map shows rider routes, shelter status, and in-transit corridors in real time.' },
              { step: '4', title: 'Rescue Protocol', desc: 'If a shelter closes, the system auto-reroutes or flags for human intervention.' },
            ].map((step, idx) => (
              <div key={idx} className="p-6 rounded-xl bg-white border border-slate-200">
                <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center text-lg font-bold mb-4">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenarios */}
      <section id="scenarios" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Proven Rescue Scenarios</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Deterministic outcomes for the most critical aid logistics failures.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Scenario A — Capacity Split',
                desc: '180 meals split across 5 riders (40-meal cap) and 3 shelters without exceeding limits.',
                icon: <Activity className="w-5 h-5 text-teal-600" />,
              },
              {
                title: 'Scenario B — Ghost Reservation',
                desc: 'Unacknowledged lease expires after 15 minutes; stock released exactly once back to pool.',
                icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
              },
              {
                title: 'Scenario C — Mid-Transit Closure',
                desc: 'Shelter closes while cargo is in transit; system auto-reroutes to feasible alternative.',
                icon: <ShieldCheck className="w-5 h-5 text-teal-600" />,
              },
            ].map((scenario, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-slate-100 bg-slate-50 hover:border-teal-200 hover:shadow-lg transition-all">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                  {scenario.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{scenario.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{scenario.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-teal-900 rounded-2xl p-8 md:p-12 text-center text-white shadow-xl shadow-teal-900/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-4">Ready to Coordinate Aid?</h2>
              <p className="text-teal-100 mb-8 max-w-xl mx-auto text-lg">
                Enter the Civora command center to manage batches, riders, shelters, and rescue operations in real time.
              </p>
              <button
                onClick={onEnterApp}
                className="px-8 py-3 bg-teal-400 hover:bg-teal-300 text-slate-900 rounded-xl font-bold text-lg shadow-lg hover:shadow-teal-500/30 transition-all"
              >
                Enter Command Center <ArrowRight className="w-5 h-5 inline ml-2" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Map className="w-6 h-6 text-teal-600" />
            <span className="text-lg font-bold text-slate-900">Civora</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-teal-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-teal-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-teal-600 transition-colors">Status</a>
          </div>
          <div className="flex gap-4">
            <a href="#" className="text-slate-400 hover:text-teal-600 transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-400 hover:text-teal-600 transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-400 hover:text-teal-600 transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
