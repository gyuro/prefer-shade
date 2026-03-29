import dynamic from 'next/dynamic';

// Load the entire interactive app client-side only.
// This is a server component — it renders nothing on the server,
// so there is zero HTML for React to hydrate against.
const ShadeApp = dynamic(() => import('@/components/ShadeApp'), { ssr: false });

export default function Page() {
  return <ShadeApp />;
}
