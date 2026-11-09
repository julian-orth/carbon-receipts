import { ReceiptList } from './components/ReceiptList'
import { ReceiptUpload } from './components/ReceiptUpload'

export function ReceiptsPage() {
  return (
    <div className="space-y-12">
      <title>Belege · Carbon Receipts</title>
      <header className="animate-rise">
        <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-[44px] sm:leading-[1.05]">
          Belege
        </h1>
        <p className="mt-2.5 text-base text-muted-foreground sm:text-[17px]">
          Fotografiere deinen Kassenbon. Den Rest rechnen wir aus.
        </p>
      </header>
      <ReceiptUpload />
      <ReceiptList />
    </div>
  )
}
