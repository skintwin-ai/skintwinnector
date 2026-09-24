import Link from 'next/link';
import {getServerSession} from 'next-auth';
import {redirect} from 'next/navigation';
import Form from './form';
import {resolvePlatformContinue} from '@/lib/platformContinue';

export default async function Login({
  searchParams,
}: {
  searchParams?: {next?: string; callbackUrl?: string};
}) {
  const session = await getServerSession();

  if (session) {
    redirect(
      resolvePlatformContinue(
        searchParams?.next || searchParams?.callbackUrl,
        process.env.NEXTAUTH_URL || 'http://localhost:3000'
      )
    );
  }

  return (
    <>
      <div>
        <h2 className="pb-2 text-2xl font-semibold">Log in</h2>
      </div>
      <div className="flex flex-col gap-y-[24px]">
        <Form />
        <div className="text-secondary">
          New user?{' '}
          <Link href="/signup" className="font-medium text-accent">
            Create an account{' '}
          </Link>
        </div>
      </div>
    </>
  );
}
