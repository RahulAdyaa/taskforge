import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutGrid, 
  CheckCircle2, 
  Clock, 
  Settings, 
  LogOut, 
  Sparkles, 
  Folder, 
  ArrowRight, 
  Calendar, 
  User, 
  Terminal 
} from 'lucide-react';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';

const DEV_QUOTES = [
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Computers are good at following instructions, but not at reading your mind.", author: "Donald Knuth" },
  { text: "The best error message is the one that never shows up.", author: "Unknown" },
  { text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson" },
  { text: "If debugging is the process of removing software bugs, then programming must be the process of putting them in.", author: "Edsger W. Dijkstra" },
  { text: "There are two ways of constructing a software design: One way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies.", author: "C.A.R. Hoare" },
  { text: "Measuring programming progress by lines of code is like measuring aircraft building progress by weight.", author: "Bill Gates" },
  { text: "Walking on water and developing software from a specification are easy if both are frozen.", author: "Edward V. Berard" },
  { text: "Code is like humor. When you have to explain it, it’s bad.", author: "Cory House" },
  { text: "Clean code always looks like it was written by someone who cares.", author: "Michael Feathers" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
  { text: "Fix the cause, not the symptom.", author: "Steve Maguire" },
  { text: "Program testing can be used to show the presence of bugs, but never to show their absence!", author: "Edsger W. Dijkstra" },
  { text: "The computer was born to solve problems that did not exist before.", author: "Bill Gates" },
  { text: "Progress is possible only when we train ourselves to think about programs without thinking of them as pieces of code.", author: "Edsger W. Dijkstra" },
  { text: "Design is not just what it looks like and feels like. Design is how it works.", author: "Steve Jobs" },
  { text: "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.", author: "Dan Salomon" },
  { text: "Software is a gas; it expands to fill its container.", author: "Nathan Myhrvold" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
  { text: "One of my most productive days was throwing away 1000 lines of code.", author: "Ken Thompson" },
  { text: "Indeed, the ratio of time spent reading code versus writing code is well over 10 to 1.", author: "Robert C. Martin" },
  { text: "Software is like entropy: It is difficult to grasp, weighs nothing, and obeys the Second Law of Thermodynamics; i.e., it always increases.", author: "Norman Augustine" },
  { text: "Perfect is the enemy of good.", author: "Voltaire" },
  { text: "It's not a bug – it's an undocumented feature.", author: "Unknown" },
  { text: "The best thing about a boolean is even if you are wrong, you are only off by a bit.", author: "Anonymous" },
  { text: "Without requirements or design, programming is the art of adding bugs to an empty text file.", author: "Louis Srygley" },
  { text: "There are only two hard things in Computer Science: cache invalidation and naming things.", author: "Phil Karlton" }
];

export default function UserLanding() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const [quote, setQuote] = useState({ text: '', author: '' });
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const randomQuote = DEV_QUOTES[Math.floor(Math.random() * DEV_QUOTES.length)];
    setQuote(randomQuote);
  }, []);

  const shuffleQuote = () => {
    if (isFading) return;
    const candidates = DEV_QUOTES.filter(q => q.text !== quote.text);
    const randomQuote = candidates[Math.floor(Math.random() * candidates.length)];
    setIsFading(true);
    setTimeout(() => {
      setQuote(randomQuote);
      setIsFading(false);
    }, 200);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    logout();
  };

  const { data: projects, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects');
      return data;
    }
  });

  const { data: tasks, isLoading: isTasksLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data } = await api.get('/my-tasks');
      return data;
    }
  });

  const pendingTasks = tasks ? tasks.filter(t => t.status !== 'DONE') : [];
  const completedTasksCount = tasks ? tasks.length - pendingTasks.length : 0;
  const completionRate = tasks && tasks.length > 0 
    ? Math.round((completedTasksCount / tasks.length) * 100) 
    : 0;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-off-white dark:bg-[#08080A] text-black dark:text-zinc-100 transition-colors duration-300 font-sans">
      {/* Premium Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F3EE]/80 dark:bg-[#08080A]/85 backdrop-blur-xl border-b border-[#E8E4DD] dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-display text-2xl font-black tracking-tight hover:text-signal-red transition-colors">
            TASKFORGE
          </Link>
          <div className="hidden md:flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="font-mono text-xs tracking-wider text-black/50 dark:text-zinc-500 uppercase">
              Operational Node
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <NotificationBell />
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-black/60 dark:text-zinc-400 hover:text-signal-red dark:hover:text-signal-red transition-colors text-sm font-medium"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Workspace Landing Container */}
      <main className="pt-28 pb-16 px-6 max-w-6xl mx-auto space-y-12">
        {/* Welcome Section */}
        <section className="bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-[2rem] p-8 md:p-12 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal-red/10 border border-signal-red/20 font-mono text-xs text-signal-red dark:text-[#FF7066] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              AUTHENTICATED SESSION
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Welcome back, <span className="text-signal-red">{user?.name || 'Developer'}</span>.
            </h1>
            <p className="text-black/60 dark:text-zinc-400 max-w-lg leading-relaxed text-sm md:text-base">
              Ready to manage your workspace? Jump straight into your active projects or track assigned tasks.
            </p>
            
            <div className="pt-4 flex flex-wrap gap-4">
              <Link 
                to="/app/dashboard" 
                className="btn-brutal bg-signal-red text-white px-8 py-3.5 rounded-full font-medium inline-flex items-center gap-2 group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Enter Workspace
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
              <Link 
                to="/app/my-tasks" 
                className="btn-brutal bg-black dark:bg-zinc-100 text-white dark:text-black px-8 py-3.5 rounded-full font-medium inline-flex items-center gap-2"
              >
                <span className="relative z-10">View My Tasks</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 font-mono text-xs text-black/50 dark:text-zinc-500 self-stretch md:self-auto justify-between border-t md:border-t-0 md:border-l border-[#E8E4DD] dark:border-zinc-800/60 pt-6 md:pt-0 md:pl-12 min-w-[200px]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-signal-red" />
              <span className="font-semibold text-black dark:text-zinc-300">{today}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-signal-red" />
              <span>User: <strong className="text-black dark:text-zinc-300">@{user?.username}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-signal-red" />
              <span>Role: <strong className="text-black dark:text-zinc-300">{user?.role || 'MEMBER'}</strong></span>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-[1.5rem] p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs tracking-wider text-black/50 dark:text-zinc-500 uppercase">Active Projects</span>
              <Folder className="w-5 h-5 text-signal-red" />
            </div>
            <div className="font-display text-4xl font-extrabold mb-1">
              {isProjectsLoading ? '...' : projects?.length || 0}
            </div>
            <p className="text-xs text-black/50 dark:text-zinc-500">Initialized workspaces you participate in.</p>
          </div>

          <div className="bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-[1.5rem] p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs tracking-wider text-black/50 dark:text-zinc-500 uppercase">Pending Tasks</span>
              <Clock className="w-5 h-5 text-signal-red" />
            </div>
            <div className="font-display text-4xl font-extrabold mb-1">
              {isTasksLoading ? '...' : pendingTasks.length}
            </div>
            <p className="text-xs text-black/50 dark:text-zinc-500">Uncompleted tasks currently assigned to you.</p>
          </div>

          <div className="bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-[1.5rem] p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs tracking-wider text-black/50 dark:text-zinc-500 uppercase">Progress Metric</span>
                <CheckCircle2 className="w-5 h-5 text-signal-red" />
              </div>
              <div className="font-display text-4xl font-extrabold mb-1">
                {isTasksLoading ? '...' : `${completionRate}%`}
              </div>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-signal-red h-full rounded-full transition-all duration-500" 
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* Dynamic Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold tracking-tight">Active Workspaces</h2>
              <Link to="/app/dashboard" className="text-signal-red hover:underline text-sm font-semibold inline-flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isProjectsLoading ? (
              <div className="h-48 border border-dashed border-[#E8E4DD] dark:border-zinc-800 rounded-2xl flex items-center justify-center font-mono text-xs text-black/40">
                Syncing active workspaces...
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.slice(0, 4).map(project => (
                  <Link 
                    key={project.id}
                    to={`/app/projects/${project.id}`}
                    className="group bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-signal-red/35 flex flex-col justify-between h-40"
                  >
                    <div>
                      <div className="font-display text-lg font-bold group-hover:text-signal-red transition-colors line-clamp-1">
                        {project.name}
                      </div>
                      <span className="font-mono text-[10px] text-black/40 dark:text-zinc-500 uppercase tracking-widest block mt-1">
                        ID: {project.id.substring(0, 8)}...
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#F5F3EE] dark:border-zinc-800/60 pt-4 mt-4 text-xs font-mono text-black/50 dark:text-zinc-500">
                      <span>Owner: <strong className="text-black dark:text-zinc-300">{project.owner?.name?.split(' ')[0] || 'Admin'}</strong></span>
                      <span className="flex items-center gap-1 text-signal-red group-hover:translate-x-1 transition-transform">
                        Launch <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-[1.5rem] p-8 text-center space-y-4">
                <Folder className="w-12 h-12 text-black/25 dark:text-zinc-600 mx-auto" />
                <h3 className="font-display text-lg font-bold">No active workspaces</h3>
                <p className="text-sm text-black/60 dark:text-zinc-400 max-w-sm mx-auto">
                  You are not currently a member of any projects. Head to the dashboard to initialize or join one.
                </p>
                <Link to="/app/dashboard" className="btn-brutal bg-signal-red text-white px-6 py-2.5 rounded-full text-sm font-semibold inline-block">
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions & Focus List Column */}
          <div className="space-y-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">Today's Focus</h2>

            {/* Task list preview */}
            <div className="bg-white dark:bg-[#0F0F12] border border-[#E8E4DD] dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              {isTasksLoading ? (
                <div className="h-32 flex items-center justify-center font-mono text-xs text-black/40">
                  Checking active tasks...
                </div>
              ) : pendingTasks.length > 0 ? (
                <div className="space-y-3">
                  {pendingTasks.slice(0, 3).map(task => (
                    <div 
                      key={task.id}
                      className="border-b border-[#F5F3EE] dark:border-zinc-800/50 last:border-0 pb-3 last:pb-0 flex items-start gap-3"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        task.priority === 'URGENT' ? 'bg-signal-red' :
                        task.priority === 'HIGH' ? 'bg-orange-500' :
                        task.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-sans text-xs text-black/50 dark:text-zinc-500 font-semibold truncate uppercase">
                          {task.projectName}
                        </div>
                        <div className="font-sans text-sm font-medium text-black dark:text-zinc-200 line-clamp-1">
                          {task.title}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Link 
                    to="/app/my-tasks"
                    className="block text-center text-xs font-semibold text-black/60 dark:text-zinc-400 hover:text-signal-red transition-colors pt-2"
                  >
                    View All {pendingTasks.length} Pending Tasks
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                  <div className="font-display text-sm font-bold">Clear Schedule!</div>
                  <p className="text-xs text-black/50 dark:text-zinc-500">You have no pending tasks assigned.</p>
                </div>
              )}
            </div>

            {/* Daily Quote widget */}
            <div 
              onClick={shuffleQuote}
              className="bg-[#F5F3EE] dark:bg-[#0F0F12]/45 border border-[#E8E4DD]/60 dark:border-zinc-800/50 rounded-2xl p-6 relative overflow-hidden cursor-pointer hover:border-signal-red/35 select-none transition-all duration-300 active:scale-[0.98] group"
              title="Click to get another quote"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[9px] tracking-wider text-black/40 dark:text-zinc-500 uppercase">
                  Inspirational Protocol
                </span>
                <span className="font-mono text-[8px] text-black/25 dark:text-zinc-600 uppercase group-hover:text-signal-red transition-colors">
                  Click to Shuffle
                </span>
              </div>
              <div className={`transition-opacity duration-200 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
                <p className="font-cursive italic text-lg text-black/85 dark:text-zinc-300 leading-relaxed">
                  "{quote.text}"
                </p>
                <span className="block text-xs font-mono text-black/50 dark:text-zinc-500 mt-2 text-right">
                  — {quote.author}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
