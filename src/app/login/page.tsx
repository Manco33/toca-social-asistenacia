import { BocoLogin } from '@/components/boco-login';
import { InstallPrompt } from '@/components/install-prompt';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-dark via-brand-dark-hover to-brand-dark p-4 sm:p-8">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <BocoLogin />
        <InstallPrompt variant="compact" className="bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white" />
      </div>
    </main>
  );
}
