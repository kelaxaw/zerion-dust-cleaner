import { DesignPage } from '@/pages/design'

export default function App() {
  if (window.location.pathname === '/design') return <DesignPage />
  return (
    <div className="p-8">
      Dust Cleanup. See <a className="text-brand underline" href="/design">/design</a>.
    </div>
  )
}
