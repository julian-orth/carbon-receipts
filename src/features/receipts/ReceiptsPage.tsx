import { useAuth } from '@/features/auth/auth-context'
import { ReceiptList } from './components/ReceiptList'
import { ReceiptUpload } from './components/ReceiptUpload'
import { useReceiptsRealtime } from './realtime'

export function ReceiptsPage() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return <ReceiptsPageContent userId={auth.user.id} />
}

function ReceiptsPageContent({ userId }: { userId: string }) {
  useReceiptsRealtime(userId)

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Belege</h1>
      <ReceiptUpload />
      <section aria-labelledby="receipts-list-title" className="space-y-3">
        <h2 id="receipts-list-title" className="text-lg font-semibold">
          Deine Belege
        </h2>
        <ReceiptList />
      </section>
    </div>
  )
}
