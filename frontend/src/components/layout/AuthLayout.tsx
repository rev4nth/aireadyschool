import { Link, Outlet } from "react-router-dom";
import { BookOpenCheck, BrainCircuit, Target, Upload } from "lucide-react";

const STEPS = [
  { icon: Upload, title: "Upload your materials", body: "Syllabus, notes, textbooks, past papers." },
  { icon: Target, title: "Take a diagnostic quiz", body: "Questions grounded in what you uploaded." },
  { icon: BrainCircuit, title: "See what you don’t know", body: "Evidence-based gaps and a revision plan." },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0B1F1C] px-10 py-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(8,127,112,0.55), transparent 45%), radial-gradient(circle at 80% 70%, rgba(67,135,216,0.25), transparent 40%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">GapFinder AI</p>
            <p className="text-sm text-white/70">Find what you don’t know.</p>
          </div>
        </div>

        <div className="relative z-10 mt-16 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Diagnose gaps. Revise with evidence. Improve with every attempt.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            GapFinder is not a generic chatbot. It uses your own study materials to test understanding,
            explain mistakes, and build a personal study plan.
          </p>
        </div>

        <ul className="relative z-10 mt-12 space-y-4">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-teal-200">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-white/65">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="relative z-10 mt-auto pt-10 text-xs text-white/45">
          Built for students who want clarity — not just another score.
        </p>
      </aside>

      <div className="flex min-h-screen flex-col bg-background px-4 py-8 sm:px-8">
        <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <Link to="/" className="text-lg font-semibold tracking-tight">
              GapFinder AI
            </Link>
            <p className="text-xs text-muted-foreground">Find what you don’t know.</p>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
