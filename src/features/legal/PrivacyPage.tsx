import { Link } from 'react-router'
import { Field, LegalPage } from './LegalPage'

export function PrivacyPage() {
  return (
    <LegalPage title="Datenschutz" required={['name', 'street', 'city', 'email', 'hostingRegion']}>
      <p>
        Hier steht, welche Daten Carbon Receipts verarbeitet, wozu, bei wem und wie du sie wieder
        loswirst. Kurz: Es gibt keine Werbung, kein Tracking und keine Weitergabe zu anderen
        Zwecken.
      </p>

      <section>
        <h2>Verantwortlich</h2>
        <p>
          <Field name="name" />, <Field name="street" />, <Field name="city" />
          <br />
          E-Mail: <Field name="email" />
        </p>
      </section>

      <section>
        <h2>Welche Daten verarbeitet werden</h2>
        <ul>
          <li>
            <strong>E-Mail-Adresse:</strong> für die Anmeldung per Login-Link und als Konto-Kennung.
          </li>
          <li>
            <strong>Belegfotos und erkannte Positionen:</strong> was du hochlädst, die erkannten
            Produkte mit Mengen, Preisen und deinen Korrekturen, sowie dein Monatsziel.
          </li>
          <li>
            <strong>Nutzungszähler:</strong> wie viele KI-Analysen du heute schon genutzt hast
            (Tageslimit).
          </li>
          <li>
            <strong>Technische Daten:</strong> beim Aufruf fallen bei den Hosting-Anbietern
            Server-Logs an (z. B. IP-Adresse, Zeitpunkt).
          </li>
        </ul>
        <p>
          Rechtsgrundlage ist die Bereitstellung der App für dich (Art. 6 Abs. 1 lit. b DSGVO) und
          der sichere Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </section>

      <section>
        <h2>An wen Daten gehen</h2>
        <ul>
          <li>
            <strong>Supabase</strong> (Datenbank, Anmeldung, Speicher der Fotos), Region:{' '}
            <Field name="hostingRegion" />.
          </li>
          <li>
            <strong>Vercel</strong> liefert die Webseite aus.
          </li>
          <li>
            <strong>Google (Gemini API)</strong> und als Ausweichdienst <strong>Groq</strong> lesen
            dein Belegfoto und liefern die erkannten Positionen. Das Foto wird dafür an den Dienst
            übertragen. Beide nutzen wir im kostenlosen Tarif; dort dürfen die Anbieter übertragene
            Daten zur Verbesserung ihrer Modelle verwenden. Lade deshalb keine Dokumente mit
            sensiblen Daten hoch. Die Übermittlung kann in Länder außerhalb der EU erfolgen.
          </li>
        </ul>
        <p>
          Der Versand der Login-Links läuft über den E-Mail-Versand von Supabase. Die CO₂-Werte
          berechnet die App selbst, ohne dass dafür Daten weitergegeben werden.
        </p>
      </section>

      <section>
        <h2>Cookies und Browser-Speicher</h2>
        <p>
          Es gibt keine Tracking- oder Werbe-Cookies. Im Browser werden nur gespeichert: deine
          Anmeldung (damit du angemeldet bleibst) und deine Wahl für hell oder dunkel.
        </p>
      </section>

      <section>
        <h2>Wie lange Daten gespeichert werden</h2>
        <p>
          Bis du dein Konto löschst. Das geht jederzeit selbst unter{' '}
          <Link to="/konto" className="underline underline-offset-4">
            Konto
          </Link>
          : Dabei werden dein Konto, alle Belege, die Fotos und alle Positionen dauerhaft gelöscht.
        </p>
      </section>

      <section>
        <h2>Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Aufsichtsbehörde.
          Auskunft und Übertragbarkeit bekommst du direkt in der App: unter „Konto“ kannst du alle
          deine Daten als Datei herunterladen. Für alles andere schreib an die oben genannte
          E-Mail-Adresse.
        </p>
      </section>

      <section>
        <h2>Demo-Konto</h2>
        <p>
          Das Demo-Konto wird von allen Besuchern geteilt und enthält nur Beispieldaten. Gib dort
          keine persönlichen Daten ein und lade keine echten Belege hoch.
        </p>
      </section>
    </LegalPage>
  )
}
