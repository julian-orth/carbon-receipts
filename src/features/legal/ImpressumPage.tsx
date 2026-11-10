import { Field, LegalPage } from './LegalPage'

export function ImpressumPage() {
  return (
    <LegalPage title="Impressum" required={['name', 'street', 'city', 'email']}>
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          <Field name="name" />
          <br />
          <Field name="street" />
          <br />
          <Field name="city" />
        </p>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail: <Field name="email" />
        </p>
      </section>
      <section>
        <h2>Über dieses Projekt</h2>
        <p>
          Carbon Receipts ist ein privates Portfolio-Projekt ohne kommerzielle Absicht. Die
          Emissionsfaktoren stammen aus den auf der Seite „Datenbasis“ genannten Studien; sie sind
          ein fester Stand und ersetzen keine verbindliche Klimabilanz.
        </p>
      </section>
      <section>
        <h2>Haftung für Inhalte</h2>
        <p>
          Die Inhalte wurden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität, insbesondere der berechneten CO₂-Werte, wird keine Gewähr übernommen.
        </p>
      </section>
    </LegalPage>
  )
}
