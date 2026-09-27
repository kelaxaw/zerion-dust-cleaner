import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/domain/notice'
import { chainById, type ChainId } from '@/lib/chains'

// Placeholder: quotes, Sweepable and the sweep itself come in the next step.
export function PlanPage({ chain, onBack }: { chain: ChainId; onBack: () => void }) {
  const { name } = chainById(chain)
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-popup flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-2">
        <Button size="icon-lg" variant="ghost" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-xl font-medium tracking-tight">Clean up {name}</h1>
      </header>
      <Notice>The plan for {name} is not built yet.</Notice>
    </main>
  )
}
